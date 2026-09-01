using System.ComponentModel.DataAnnotations;

namespace Sona.Server.Data.DbModels;

/// <summary>Campus/location grouping within an organization. Admin structure only — departments message patients.</summary>
public class Site : EntityBase
{
    public Guid OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [Required]
    [MaxLength(200)]
    public required string Name { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Department> Departments { get; set; } = new List<Department>();
}
