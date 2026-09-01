using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using Sona.Server.Data;
using Sona.Server.Models.Commons;

namespace Sona.Server.Data.DbModels;

public class AppUser
{
    [Key]
    public int Id { get; set; }
    public string? HCAID { get; set; }
    public string? DisplayName { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }

    /// <summary>Informational MSGraph department string — NOT authorization data (that's Role + UserDepartmentAccess).</summary>
    public string? EmpDept { get; set; }

    public DateTime? LastLogin { get; set; }

    /// <summary>One of UserRoles: system_admin, org_admin, staff, unassigned. Single-org MVP — plain column, not a scoped assignment table.</summary>
    [MaxLength(20)]
    public string Role { get; set; } = UserRoles.Unassigned;

    /// <summary>Tenant. Null for system_admin (sees everything) and unassigned (not yet provisioned).</summary>
    public Guid? OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    /// <summary>Department scoping rows — only meaningful when Role is "staff".</summary>
    public ICollection<UserDepartmentAccess> DepartmentAccess { get; set; } = new List<UserDepartmentAccess>();

    public DateTime InDate { get; set; }
    public DateTime ModDate { get; set; }
}
