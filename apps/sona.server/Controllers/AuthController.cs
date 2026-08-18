using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc;

namespace Sona.Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : Controller
{
    private readonly IConfiguration _configuration;

    public AuthController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("login")]
    public IActionResult Login()
    {
        var properties = new AuthenticationProperties { RedirectUri = _configuration["AzureAd:RedirectUri"] };
        // This explicitly tells ASP.NET to start the Entra ID handshake
        return Challenge(properties, OpenIdConnectDefaults.AuthenticationScheme);
    }

}
