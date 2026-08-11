using Sona.Api.Data;

namespace Sona.Api.Features.Users;

/// <summary>
/// Internal staff user of the admin platform (nurse, provider, admin).
/// No credential columns until the auth approach is decided — see
/// docs/data-model.md open questions.
/// </summary>
public class AppUser : EntityBase
{
    public required string FirstName { get; set; }

    public required string LastName { get; set; }

    public required string Email { get; set; }

    /// <summary>One of: nurse, provider, admin (matches UserRole in @sona/shared).</summary>
    public required string Role { get; set; }

    /// <summary>Deactivate instead of delete — sent messages keep a valid sender reference.</summary>
    public bool IsActive { get; set; } = true;
}
