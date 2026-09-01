using System.ComponentModel.DataAnnotations;

namespace Sona.Server.Data.DbModels;

/// <summary>
/// Directory entity for providers who see patients. Separate from AppUser —
/// front desk sends notifications on behalf of providers; some providers never log in.
/// </summary>
public class Provider : EntityBase
{
    /// <summary>Owning tenant — provider dropdowns are org-scoped.</summary>
    public Guid OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [Required]
    [MaxLength(100)]
    public required string FirstName { get; set; }

    [Required]
    [MaxLength(100)]
    public required string LastName { get; set; }

    [MaxLength(50)]
    public string? Credentials { get; set; }

    /// <summary>National Provider Identifier — 10 digits, unique when present.</summary>
    [MaxLength(10)]
    public string? Npi { get; set; }

    [MaxLength(200)]
    public string? Specialty { get; set; }

    /// <summary>Optional link to a staff login account.</summary>
    public int? AppUserId { get; set; }

    public AppUser? AppUser { get; set; }

    public bool IsActive { get; set; } = true;
}
