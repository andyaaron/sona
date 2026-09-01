using System.ComponentModel.DataAnnotations;

namespace Sona.Server.Data.DbModels;

/// <summary>
/// Tenant root. Fixed 3-level chain Organization → Site → Department (docs/tasks/08).
/// A practice is the simple case (one auto-created "Main" site + "General"
/// department); a hospital is the same structure with more rows.
/// </summary>
public class Organization : EntityBase
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; set; }

    /// <summary>One of: practice, hospital.</summary>
    [Required]
    [MaxLength(20)]
    public required string Type { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Site> Sites { get; set; } = new List<Site>();
}
