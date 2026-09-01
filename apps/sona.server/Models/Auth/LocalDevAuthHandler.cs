using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Sona.Server.Models.Commons;

namespace Sona.Server.Models.Auth;

public static class LocalDevAuthDefaults
{
    public const string AuthenticationScheme = "LocalDev";

    /// <summary>Configuration section in appsettings.Local.json.</summary>
    public const string ConfigSection = "LocalDevAuth";

    /// <summary>Environment name that is the ONLY one allowed to use this scheme.</summary>
    public const string LocalEnvironmentName = "Local";
}

public class LocalDevAuthOptions : AuthenticationSchemeOptions
{
    /// <summary>34Id — becomes preferred_username "{Hca34Id}@hca.corpad.net".</summary>
    public string Hca34Id { get; set; } = "DEV001";

    public string Name { get; set; } = "Dev Admin";

    public string Email { get; set; } = "dev.admin@example.com";
}

/// <summary>
/// Personal-machine stub for the Entra OIDC handler: every request authenticates as the
/// single identity configured in appsettings.Local.json. It emits exactly the claims the
/// app reads from a real Entra token and deliberately emits no role claim — roles still
/// come from AppUsers.Role via CurrentUserService, so tenant/role enforcement is exercised
/// for real. Only ever registered when ASPNETCORE_ENVIRONMENT=Local.
/// </summary>
public class LocalDevAuthHandler : AuthenticationHandler<LocalDevAuthOptions>
{
    public LocalDevAuthHandler(
        IOptionsMonitor<LocalDevAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IHostEnvironment environment)
        : base(options, logger, encoder)
    {
        // Belt and braces: a mis-registration must fail loudly at startup, never
        // silently authenticate everyone in a real environment.
        if (!environment.IsEnvironment(LocalDevAuthDefaults.LocalEnvironmentName))
        {
            throw new InvalidOperationException(
                $"{nameof(LocalDevAuthHandler)} may only be used when ASPNETCORE_ENVIRONMENT="
                + $"'{LocalDevAuthDefaults.LocalEnvironmentName}' (current: '{environment.EnvironmentName}').");
        }
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var hca34Id = Options.Hca34Id.ToUpperInvariant();
        var nameParts = Options.Name.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var firstName = nameParts.Length > 0 ? nameParts[0] : "Dev";
        var lastName = nameParts.Length > 1 ? nameParts[1] : "Admin";

        var claims = new[]
        {
            new Claim(ConstantDefaults.ENTRAID_CLAIMS_USER_PRINCIPAL_NAME, $"{hca34Id}@hca.corpad.net"),
            new Claim("name", Options.Name),
            new Claim(ConstantDefaults.ENTRAID_CLAIMS_USER_FIRST_NAME, firstName),
            new Claim(ConstantDefaults.ENTRAID_CLAIMS_USER_LAST_NAME, lastName),
            new Claim(ConstantDefaults.ENTRAID_CLAIMS_USER_EMAIL, Options.Email),
        };

        var identity = new ClaimsIdentity(claims, LocalDevAuthDefaults.AuthenticationScheme, "name", null);
        var ticket = new AuthenticationTicket(
            new ClaimsPrincipal(identity),
            LocalDevAuthDefaults.AuthenticationScheme);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
