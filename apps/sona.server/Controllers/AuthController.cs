using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc;
using Sona.Server.Models.Auth;

namespace Sona.Server.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : Controller
{
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;

    public AuthController(IConfiguration configuration, IHostEnvironment environment)
    {
        _configuration = configuration;
        _environment = environment;
    }

    [HttpGet("login")]
    public IActionResult Login()
    {
        // Post-login landing page. Relative "/" works on any host (Azure included); Development
        // overrides it with the Vite dev-server origin because the API and admin run on
        // different ports there.
        var redirectUri = _configuration["AzureAd:RedirectUri"] ?? "/";

        // Local mode already authenticates every request, so challenging a scheme that
        // always succeeds is meaningless — bounce straight back to the app instead.
        if (_environment.IsEnvironment(LocalDevAuthDefaults.LocalEnvironmentName))
        {
            return Redirect(redirectUri);
        }

        var properties = new AuthenticationProperties { RedirectUri = redirectUri };
        // This explicitly tells ASP.NET to start the Entra ID handshake
        return Challenge(properties, OpenIdConnectDefaults.AuthenticationScheme);
    }

}
