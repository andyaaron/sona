using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using Sona.Api.Data;

namespace Sona.Api.Data.DbModels;

/// <summary>
/// Internal staff user of the admin platform (nurse, provider, admin).
/// No credential columns until the auth approach is decided — see
/// docs/data-model.md open questions.
/// </summary>
public class AppUser
{
    [Key]
    public int Id { get; set; }

    public string Hca34id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public int? AccessLevelId { get; set; }

    public int? DefaultFacilityId { get; set; }

    public DateTime? LastLogin { get; set; }

    public bool IsDarkMode { get; set; } = false;

    public string? Thumbnail { get; set; }

    public DateTime DateCreated { get; set; }

    public string CreatedBy { get; set; } = null!;

    [ForeignKey("AccessLevelId")]
    public virtual AccessLevel? AccessLevel { get; set; }
}
