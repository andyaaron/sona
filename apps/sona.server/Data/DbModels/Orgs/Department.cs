using System.ComponentModel.DataAnnotations;

namespace Sona.Server.Data.DbModels;

/// <summary>
/// The unit that messages patients (ED waiting, Lab, Imaging). Department names
/// can imply a condition — they must never appear in notification payloads,
/// logs, or URLs (docs/compliance.md); only the opaque id is referenced.
/// </summary>
public class Department : EntityBase
{
    public Guid SiteId { get; set; }

    public Site? Site { get; set; }

    [Required]
    [MaxLength(200)]
    public required string Name { get; set; }

    public bool IsActive { get; set; } = true;
}
