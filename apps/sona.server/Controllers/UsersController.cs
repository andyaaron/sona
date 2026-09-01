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
/// User management (Task 8b). Extends the old UserController — GET /api/user is
/// unchanged and open to any authenticated user (unassigned users need it for
/// the pending-approval screen); management endpoints require org_admin.
/// </summary>
[Authorize]
[ApiController]
public class UsersController : Controller
{
    private static readonly string[] ValidRoles =
        { UserRoles.SystemAdmin, UserRoles.OrgAdmin, UserRoles.Staff, UserRoles.Unassigned };

    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAppUserUtil _appUserUtil;
    private readonly IMSGraphHelper _msGraph;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        ApplicationDbContext db,
        ICurrentUserService currentUserService,
        IAppUserUtil appUserUtil,
        IMSGraphHelper msGraph,
        ILogger<UsersController> logger)
    {
        _db = db;
        _currentUserService = currentUserService;
        _appUserUtil = appUserUtil;
        _msGraph = msGraph;
        _logger = logger;
    }

    // GET: /api/user — the authenticated caller's own profile (any role, incl. unassigned)
    [HttpGet("/api/user")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await _currentUserService.GetCurrentUserAsync();

        if (user == null)
            return NotFound("User not found.");
        return Ok(user);
    }

    // GET: /api/users?role= — org_admin: own org + all unassigned (pending queue); system_admin: all
    [HttpGet("/api/users")]
    [Authorize(Policy = Policies.OrgAdmin)]
    public async Task<IActionResult> GetUsers([FromQuery] string? role)
    {
        var current = await _currentUserService.GetCurrentUserAsync();
        if (current == null)
            return Unauthorized();

        var query = _db.AppUsers.AsNoTracking()
            .Include(u => u.DepartmentAccess)
            .AsQueryable();

        if (current.Role != UserRoles.SystemAdmin)
            query = query.Where(u => u.OrganizationId == current.OrganizationId || u.Role == UserRoles.Unassigned);

        if (!string.IsNullOrEmpty(role))
        {
            if (!ValidRoles.Contains(role))
                return BadRequest(new { error = "Unknown role filter." });
            query = query.Where(u => u.Role == role);
        }

        var users = await query
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .ToListAsync();

        return Ok(users.Select(ToSummary).ToList());
    }

    // PUT: /api/users/{id} — assign org/role/departments (replace-set semantics)
    [HttpPut("/api/users/{id:int}")]
    [Authorize(Policy = Policies.OrgAdmin)]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest input)
    {
        var current = await _currentUserService.GetCurrentUserAsync();
        if (current?.Hca34Id == null)
            return Unauthorized();
        var callerRow = await _appUserUtil.GetAppUser(current.Hca34Id);

        var target = await _db.AppUsers
            .Include(u => u.DepartmentAccess)
            .FirstOrDefaultAsync(u => u.Id == id);
        if (target == null)
            return NotFound();

        var isSystemAdmin = current.Role == UserRoles.SystemAdmin;

        // org_admin can only reach users of their own org, plus the unassigned pending queue.
        // 404, not 403 — don't leak that a user of another org exists.
        if (!isSystemAdmin && target.OrganizationId != current.OrganizationId && target.Role != UserRoles.Unassigned)
            return NotFound();

        if (!ValidRoles.Contains(input.Role))
            return BadRequest(new { error = "Unknown role." });

        // Lockout guard: an org_admin cannot change their own role.
        if (!isSystemAdmin && callerRow != null && callerRow.Id == target.Id && input.Role != target.Role)
            return BadRequest(new { error = "You cannot change your own role." });

        // org_admin cannot grant system_admin, and can only assign into their own org.
        if (!isSystemAdmin)
        {
            if (input.Role == UserRoles.SystemAdmin)
                return BadRequest(new { error = "Only a system admin can grant system_admin." });
            if (input.OrganizationId != null && input.OrganizationId != current.OrganizationId)
                return BadRequest(new { error = "You can only assign users to your own organization." });
        }

        // Contract rules (mirror updateUserSchema in @sona/shared)
        Guid? newOrgId;
        switch (input.Role)
        {
            case UserRoles.SystemAdmin:
            case UserRoles.Unassigned:
                newOrgId = null; // system_admin sees everything; unassigned is not yet provisioned
                break;
            default:
                if (input.OrganizationId == null)
                    return BadRequest(new { error = "An organization is required for this role." });
                if (!await _db.Organizations.AnyAsync(o => o.Id == input.OrganizationId))
                    return BadRequest(new { error = "Unknown organization." });
                newOrgId = input.OrganizationId;
                break;
        }

        var departmentIds = (input.DepartmentIds ?? new List<Guid>()).Distinct().ToList();
        if (input.Role != UserRoles.Staff && departmentIds.Count > 0)
            return BadRequest(new { error = "Only staff are scoped to departments." });

        if (input.Role == UserRoles.Staff)
        {
            var orgDepartmentIds = await _db.Departments
                .Where(d => d.Site!.OrganizationId == newOrgId && d.IsActive)
                .Select(d => d.Id)
                .ToListAsync();

            if (departmentIds.Any(d => !orgDepartmentIds.Contains(d)))
                return BadRequest(new { error = "All departments must belong to the user's organization." });

            // Single-department orgs auto-scope; multi-department orgs need an explicit choice.
            if (orgDepartmentIds.Count > 1 && departmentIds.Count == 0)
                return BadRequest(new { error = "Staff in a multi-department organization need at least one department." });
            if (orgDepartmentIds.Count == 1 && departmentIds.Count == 0)
                departmentIds = orgDepartmentIds;
        }

        target.Role = input.Role;
        target.OrganizationId = newOrgId;
        target.ModDate = DateTime.Now;

        // Replace-set the department access rows
        _db.UserDepartmentAccesses.RemoveRange(target.DepartmentAccess);
        foreach (var departmentId in departmentIds)
            _db.UserDepartmentAccesses.Add(new UserDepartmentAccess { AppUserId = target.Id, DepartmentId = departmentId });

        await _db.SaveChangesAsync();
        _logger.LogInformation("User {TargetUserId} updated to role {Role} by user {CallerUserId}", target.Id, target.Role, callerRow?.Id);

        // Re-read access rows for the response
        var freshDepartmentIds = await _db.UserDepartmentAccesses
            .Where(a => a.AppUserId == target.Id)
            .Select(a => a.DepartmentId)
            .ToListAsync();

        return Ok(ToSummary(target, freshDepartmentIds));
    }

    // GET: /api/users/directory-search?q= — HCA directory (MSGraph) for the invite-first flow.
    // Returns name/email/34Id only. Never log the query string with results.
    [HttpGet("/api/users/directory-search")]
    [Authorize(Policy = Policies.OrgAdmin)]
    public async Task<IActionResult> DirectorySearch([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return BadRequest(new { error = "Provide at least 2 characters to search." });

        try
        {
            var graphUsers = await _msGraph.GetUserDetails(q.Trim());

            var results = graphUsers
                .Where(u => u.UserPrincipalName != null)
                .Select(u => new DirectoryUserDto
                {
                    Hca34Id = u.UserPrincipalName!.Split('@')[0].ToUpper(),
                    DisplayName = u.DisplayName,
                    Email = u.Mail,
                })
                .Take(ConstantDefaults.MSGRAPH_RETURN_QUANTITY)
                .ToList();

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Directory search failed");
            return StatusCode(503, new { error = "Directory search is unavailable." });
        }
    }

    // POST: /api/users/invite — pre-provision a directory user with org + role + departments.
    // JIT login later finds this row by HCAID (CheckAndSetEmployee checks AppUserExist first).
    [HttpPost("/api/users/invite")]
    [Authorize(Policy = Policies.OrgAdmin)]
    public async Task<IActionResult> InviteUser([FromBody] InviteUserRequest input)
    {
        var current = await _currentUserService.GetCurrentUserAsync();
        if (current == null)
            return Unauthorized();

        var isSystemAdmin = current.Role == UserRoles.SystemAdmin;
        var hca34Id = input.Hca34Id?.Trim().ToUpper();
        if (string.IsNullOrEmpty(hca34Id) || hca34Id.Length < 3 || hca34Id.Length > 10)
            return BadRequest(new { error = "A valid 34 ID is required." });

        if (!ValidRoles.Contains(input.Role) || input.Role == UserRoles.Unassigned)
            return BadRequest(new { error = "Invite with a real role (staff, org_admin, or system_admin)." });
        if (!isSystemAdmin && input.Role == UserRoles.SystemAdmin)
            return BadRequest(new { error = "Only a system admin can grant system_admin." });

        Guid? orgId;
        if (input.Role == UserRoles.SystemAdmin)
        {
            orgId = null;
        }
        else if (isSystemAdmin)
        {
            if (input.OrganizationId == null)
                return BadRequest(new { error = "An organization is required for this role." });
            if (!await _db.Organizations.AnyAsync(o => o.Id == input.OrganizationId))
                return BadRequest(new { error = "Unknown organization." });
            orgId = input.OrganizationId;
        }
        else
        {
            orgId = current.OrganizationId; // org admins always invite into their own org
        }

        var departmentIds = (input.DepartmentIds ?? new List<Guid>()).Distinct().ToList();
        if (input.Role != UserRoles.Staff && departmentIds.Count > 0)
            return BadRequest(new { error = "Only staff are scoped to departments." });

        if (input.Role == UserRoles.Staff)
        {
            var orgDepartmentIds = await _db.Departments
                .Where(d => d.Site!.OrganizationId == orgId && d.IsActive)
                .Select(d => d.Id)
                .ToListAsync();

            if (departmentIds.Any(d => !orgDepartmentIds.Contains(d)))
                return BadRequest(new { error = "All departments must belong to the organization." });
            if (orgDepartmentIds.Count > 1 && departmentIds.Count == 0)
                return BadRequest(new { error = "Staff in a multi-department organization need at least one department." });
            if (orgDepartmentIds.Count == 1 && departmentIds.Count == 0)
                departmentIds = orgDepartmentIds;
        }

        if (await _appUserUtil.AppUserExist(hca34Id))
            return Conflict(new { error = "This person already has an account. Edit them in the user list instead." });

        var user = new AppUser
        {
            HCAID = hca34Id,
            Role = input.Role,
            OrganizationId = orgId,
            InDate = DateTime.Now,
            ModDate = DateTime.Now,
        };

        // Best-effort name/email from the directory — JIT login only stamps LastLogin
        // on existing rows, so this is the one chance to populate them automatically.
        try
        {
            var details = (await _msGraph.GetUserDetails(hca34Id))
                .FirstOrDefault(u => u.UserPrincipalName != null
                    && u.UserPrincipalName.Split('@')[0].ToUpper() == hca34Id);
            if (details != null)
            {
                user.DisplayName = details.DisplayName;
                user.FirstName = details.GivenName;
                user.LastName = details.Surname;
                user.Email = details.Mail;
                user.EmpDept = details.Department;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Directory lookup during invite failed; creating the user with 34 ID only");
        }

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync();

        foreach (var departmentId in departmentIds)
            _db.UserDepartmentAccesses.Add(new UserDepartmentAccess { AppUserId = user.Id, DepartmentId = departmentId });
        if (departmentIds.Count > 0)
            await _db.SaveChangesAsync();

        _logger.LogInformation("User {NewUserId} invited with role {Role}", user.Id, user.Role);

        return CreatedAtAction(nameof(GetUsers), null, ToSummary(user, departmentIds));
    }

    private static AppUserSummaryDto ToSummary(AppUser user) =>
        ToSummary(user, user.DepartmentAccess.Select(a => a.DepartmentId).ToList());

    private static AppUserSummaryDto ToSummary(AppUser user, List<Guid> departmentIds) => new()
    {
        Id = user.Id,
        Hca34Id = user.HCAID,
        DisplayName = user.DisplayName,
        Email = user.Email,
        Role = user.Role,
        OrganizationId = user.OrganizationId?.ToString(),
        DepartmentIds = departmentIds.Select(d => d.ToString()).ToList(),
        LastLogin = user.LastLogin?.ToString("O"),
    };

    private sealed class AppUserSummaryDto
    {
        public int Id { get; set; }
        public string? Hca34Id { get; set; }
        public string? DisplayName { get; set; }
        public string? Email { get; set; }
        public string Role { get; set; } = "";
        public string? OrganizationId { get; set; }
        public List<string> DepartmentIds { get; set; } = new();
        public string? LastLogin { get; set; }
    }

    private sealed class DirectoryUserDto
    {
        public string Hca34Id { get; set; } = "";
        public string? DisplayName { get; set; }
        public string? Email { get; set; }
    }

    public sealed class UpdateUserRequest
    {
        public string Role { get; set; } = "";
        public Guid? OrganizationId { get; set; }
        public List<Guid>? DepartmentIds { get; set; }
    }

    public sealed class InviteUserRequest
    {
        public string? Hca34Id { get; set; }
        public string Role { get; set; } = "";
        public List<Guid>? DepartmentIds { get; set; }
        public Guid? OrganizationId { get; set; }
    }
}
