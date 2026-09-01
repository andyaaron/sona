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
/// Org hierarchy management (Task 8b). Fixed 3 levels: Organization → Site →
/// Department. Deactivate, never delete. Cross-org access by id returns 404
/// (not 403 — don't leak existence, docs/compliance.md).
/// </summary>
[Authorize(Policy = Policies.OrgAdmin)]
[ApiController]
public class OrganizationsController : Controller
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;

    public OrganizationsController(ApplicationDbContext db, ICurrentUserService currentUserService)
    {
        _db = db;
        _currentUserService = currentUserService;
    }

    // GET: /api/organizations — system_admin: all; org_admin: own org only
    [HttpGet("/api/organizations")]
    public async Task<IActionResult> GetOrganizations()
    {
        var current = await _currentUserService.GetCurrentUserAsync();
        if (current == null)
            return Unauthorized();

        var query = _db.Organizations.AsNoTracking().AsQueryable();
        if (current.Role != UserRoles.SystemAdmin)
            query = query.Where(o => o.Id == current.OrganizationId);

        var orgs = await query
            .OrderBy(o => o.Name)
            .Select(o => ToResponse(o))
            .ToListAsync();

        return Ok(orgs);
    }

    // POST: /api/organizations — system_admin only; auto-creates "Main" site + "General" department
    [HttpPost("/api/organizations")]
    [Authorize(Policy = Policies.SystemAdmin)]
    public async Task<IActionResult> CreateOrganization([FromBody] CreateOrganizationRequest input)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 200)
            return BadRequest(new { error = "Organization name is required (max 200 chars)." });
        if (input.Type != "practice" && input.Type != "hospital")
            return BadRequest(new { error = "Type must be 'practice' or 'hospital'." });

        // Every org always has ≥1 site and each site ≥1 department (design decision 1).
        // Single SaveChanges = single transaction.
        var org = new Organization { Name = input.Name.Trim(), Type = input.Type };
        var site = new Site { OrganizationId = org.Id, Name = "Main" };
        var department = new Department { SiteId = site.Id, Name = "General" };

        _db.Organizations.Add(org);
        _db.Sites.Add(site);
        _db.Departments.Add(department);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetOrganizations), null, ToResponse(org));
    }

    // GET: /api/organizations/{id}/sites
    [HttpGet("/api/organizations/{id:guid}/sites")]
    public async Task<IActionResult> GetSites(Guid id)
    {
        if (!await CanAccessOrgAsync(id))
            return NotFound();

        var sites = await _db.Sites.AsNoTracking()
            .Where(s => s.OrganizationId == id)
            .OrderBy(s => s.Name)
            .Select(s => ToResponse(s))
            .ToListAsync();

        return Ok(sites);
    }

    // POST: /api/organizations/{id}/sites
    [HttpPost("/api/organizations/{id:guid}/sites")]
    public async Task<IActionResult> CreateSite(Guid id, [FromBody] NameRequest input)
    {
        if (!await CanAccessOrgAsync(id))
            return NotFound();
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 200)
            return BadRequest(new { error = "Site name is required (max 200 chars)." });

        var site = new Site { OrganizationId = id, Name = input.Name.Trim() };
        _db.Sites.Add(site);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSites), new { id }, ToResponse(site));
    }

    // PUT: /api/sites/{id} — rename / deactivate (never delete)
    [HttpPut("/api/sites/{id:guid}")]
    public async Task<IActionResult> UpdateSite(Guid id, [FromBody] UpdateNameRequest input)
    {
        var site = await _db.Sites.FirstOrDefaultAsync(s => s.Id == id);
        if (site == null || !await CanAccessOrgAsync(site.OrganizationId))
            return NotFound();

        if (input.Name != null)
        {
            if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 200)
                return BadRequest(new { error = "Site name is required (max 200 chars)." });
            site.Name = input.Name.Trim();
        }
        if (input.IsActive.HasValue)
            site.IsActive = input.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(ToResponse(site));
    }

    // GET: /api/sites/{id}/departments
    [HttpGet("/api/sites/{id:guid}/departments")]
    public async Task<IActionResult> GetDepartments(Guid id)
    {
        var site = await _db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (site == null || !await CanAccessOrgAsync(site.OrganizationId))
            return NotFound();

        var departments = await _db.Departments.AsNoTracking()
            .Where(d => d.SiteId == id)
            .OrderBy(d => d.Name)
            .Select(d => ToResponse(d))
            .ToListAsync();

        return Ok(departments);
    }

    // POST: /api/sites/{id}/departments
    [HttpPost("/api/sites/{id:guid}/departments")]
    public async Task<IActionResult> CreateDepartment(Guid id, [FromBody] NameRequest input)
    {
        var site = await _db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (site == null || !await CanAccessOrgAsync(site.OrganizationId))
            return NotFound();
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 200)
            return BadRequest(new { error = "Department name is required (max 200 chars)." });

        var department = new Department { SiteId = id, Name = input.Name.Trim() };
        _db.Departments.Add(department);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDepartments), new { id }, ToResponse(department));
    }

    // PUT: /api/departments/{id} — rename / deactivate (never delete)
    [HttpPut("/api/departments/{id:guid}")]
    public async Task<IActionResult> UpdateDepartment(Guid id, [FromBody] UpdateNameRequest input)
    {
        var department = await _db.Departments
            .Include(d => d.Site)
            .FirstOrDefaultAsync(d => d.Id == id);
        if (department?.Site == null || !await CanAccessOrgAsync(department.Site.OrganizationId))
            return NotFound();

        if (input.Name != null)
        {
            if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 200)
                return BadRequest(new { error = "Department name is required (max 200 chars)." });
            department.Name = input.Name.Trim();
        }
        if (input.IsActive.HasValue)
            department.IsActive = input.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(ToResponse(department));
    }

    /// <summary>system_admin reaches every org; org_admin only their own.</summary>
    private async Task<bool> CanAccessOrgAsync(Guid organizationId)
    {
        var current = await _currentUserService.GetCurrentUserAsync();
        if (current == null)
            return false;
        return current.Role == UserRoles.SystemAdmin || current.OrganizationId == organizationId;
    }

    private static OrganizationResponseDto ToResponse(Organization org) => new()
    {
        Id = org.Id.ToString(),
        Name = org.Name,
        Type = org.Type,
        IsActive = org.IsActive,
        CreateDate = org.CreateDate.ToString("O"),
        ModDate = org.ModDate.ToString("O"),
    };

    private static SiteResponseDto ToResponse(Site site) => new()
    {
        Id = site.Id.ToString(),
        OrganizationId = site.OrganizationId.ToString(),
        Name = site.Name,
        IsActive = site.IsActive,
        CreateDate = site.CreateDate.ToString("O"),
        ModDate = site.ModDate.ToString("O"),
    };

    private static DepartmentResponseDto ToResponse(Department department) => new()
    {
        Id = department.Id.ToString(),
        SiteId = department.SiteId.ToString(),
        Name = department.Name,
        IsActive = department.IsActive,
        CreateDate = department.CreateDate.ToString("O"),
        ModDate = department.ModDate.ToString("O"),
    };

    private sealed class OrganizationResponseDto
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public bool IsActive { get; set; }
        public string CreateDate { get; set; } = "";
        public string ModDate { get; set; } = "";
    }

    private sealed class SiteResponseDto
    {
        public string Id { get; set; } = "";
        public string OrganizationId { get; set; } = "";
        public string Name { get; set; } = "";
        public bool IsActive { get; set; }
        public string CreateDate { get; set; } = "";
        public string ModDate { get; set; } = "";
    }

    private sealed class DepartmentResponseDto
    {
        public string Id { get; set; } = "";
        public string SiteId { get; set; } = "";
        public string Name { get; set; } = "";
        public bool IsActive { get; set; }
        public string CreateDate { get; set; } = "";
        public string ModDate { get; set; } = "";
    }

    public sealed class CreateOrganizationRequest
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
    }

    public sealed class NameRequest
    {
        public string Name { get; set; } = "";
    }

    public sealed class UpdateNameRequest
    {
        public string? Name { get; set; }
        public bool? IsActive { get; set; }
    }
}
