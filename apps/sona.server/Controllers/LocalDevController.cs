using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sona.Server.Data;
using Sona.Server.Data.DbModels;
using Sona.Server.Models.Auth;
using Sona.Server.Models.Commons;
using Sona.Server.Models.Util;

namespace Sona.Server.Controllers;

/// <summary>
/// Local-only test helper for the Playwright suite (apps/sona.client/e2e/fixtures/roles.ts).
/// The stub user is the only identity in Local, and the real user endpoints refuse to let a
/// caller change their own role, so specs need a side door to become org_admin/staff/unassigned
/// and back. Every action answers 404 outside ASPNETCORE_ENVIRONMENT=Local — the same gate
/// Program.cs uses for the LocalDev auth scheme.
/// </summary>
[Authorize]
[ApiController]
[Route("/api/local")]
public class LocalDevController : Controller
{
    private static readonly string[] ValidRoles =
        { UserRoles.SystemAdmin, UserRoles.OrgAdmin, UserRoles.Staff, UserRoles.Unassigned };

    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;
    private readonly IHostEnvironment _env;

    public LocalDevController(ApplicationDbContext db, ICurrentUserService currentUserService, IHostEnvironment env)
    {
        _db = db;
        _currentUserService = currentUserService;
        _env = env;
    }

    private bool IsLocal => _env.IsEnvironment(LocalDevAuthDefaults.LocalEnvironmentName);

    public class SetMyRoleRequest
    {
        public string Role { get; set; } = UserRoles.SystemAdmin;
        public Guid? OrganizationId { get; set; }
        public List<Guid>? DepartmentIds { get; set; }
    }

    // PUT: /api/local/me/role — set the stub user's role/org/departments (replace-set).
    [HttpPut("me/role")]
    public async Task<IActionResult> SetMyRole([FromBody] SetMyRoleRequest input)
    {
        if (!IsLocal)
            return NotFound();

        var current = await _currentUserService.GetCurrentUserAsync();
        if (current?.Hca34Id == null)
            return Unauthorized();
        if (!ValidRoles.Contains(input.Role))
            return BadRequest(new { error = "Unknown role." });

        var me = await _db.AppUsers
            .Include(u => u.DepartmentAccess)
            .FirstOrDefaultAsync(u => u.HCAID == current.Hca34Id);
        if (me == null)
            return NotFound();

        var needsOrg = input.Role == UserRoles.OrgAdmin || input.Role == UserRoles.Staff;
        me.Role = input.Role;
        me.OrganizationId = needsOrg ? input.OrganizationId : null;
        me.ModDate = DateTime.Now;

        _db.UserDepartmentAccesses.RemoveRange(me.DepartmentAccess);
        if (input.Role == UserRoles.Staff)
        {
            foreach (var departmentId in (input.DepartmentIds ?? new List<Guid>()).Distinct())
                _db.UserDepartmentAccesses.Add(new UserDepartmentAccess { AppUserId = me.Id, DepartmentId = departmentId });
        }

        await _db.SaveChangesAsync();
        return Ok(new { me.Id, me.Role, me.OrganizationId });
    }
}
