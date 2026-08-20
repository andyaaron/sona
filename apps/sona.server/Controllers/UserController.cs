using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sona.Server.Data.DbModels;
using Sona.Server.Models.Util;

namespace Sona.Server.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class UserController : Controller
{
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<UserController> _logger;

    public UserController(
        ILogger<UserController> logger,
        ICurrentUserService currentUserService
    )
    {
        _logger = logger;
        _currentUserService = currentUserService;
    }

    // GET: /api/user
    [HttpGet]
    [Route("/api/user")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await _currentUserService.GetCurrentUserAsync();

        if (user == null)
            return NotFound("User not found.");
        return Ok(user);
    }
}
