using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sona.Server.Data;
using Sona.Server.Data.DbModels;

namespace Sona.Server.Controllers;

[Authorize(Policy = Sona.Server.Models.Auth.Policies.AssignedUser)]
[Route("api/[controller]")]
[ApiController]
public class ProvidersController : Controller
{
    private readonly ApplicationDbContext _db;

    public ProvidersController(ApplicationDbContext db)
    {
        _db = db;
    }

    // GET: /api/providers?isActive=true
    [HttpGet]
    public async Task<IActionResult> GetProviders([FromQuery] bool? isActive)
    {
        var query = _db.Providers.AsNoTracking().AsQueryable();

        if (isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        var providers = await query
            .OrderBy(p => p.LastName)
            .ThenBy(p => p.FirstName)
            .Select(p => ToResponse(p))
            .ToListAsync();

        return Ok(providers);
    }

    // POST: /api/providers
    [HttpPost]
    public async Task<IActionResult> CreateProvider([FromBody] CreateProviderRequest input)
    {
        if (string.IsNullOrWhiteSpace(input.FirstName) || string.IsNullOrWhiteSpace(input.LastName))
            return BadRequest(new { error = "First name and last name are required." });

        if (!string.IsNullOrEmpty(input.Npi))
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(input.Npi, @"^\d{10}$"))
                return BadRequest(new { error = "NPI must be exactly 10 digits." });

            var npiExists = await _db.Providers.AnyAsync(p => p.Npi == input.Npi);
            if (npiExists)
                return Conflict(new { error = "A provider with this NPI already exists." });
        }

        var provider = new Provider
        {
            FirstName = input.FirstName.Trim(),
            LastName = input.LastName.Trim(),
            Credentials = input.Credentials?.Trim(),
            Npi = string.IsNullOrEmpty(input.Npi) ? null : input.Npi.Trim(),
            Specialty = input.Specialty?.Trim(),
            AppUserId = input.AppUserId,
            IsActive = true,
        };

        _db.Providers.Add(provider);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProviders), null, ToResponse(provider));
    }

    // PUT: /api/providers/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateProvider(Guid id, [FromBody] UpdateProviderRequest input)
    {
        var provider = await _db.Providers.FirstOrDefaultAsync(p => p.Id == id);
        if (provider == null)
            return NotFound();

        if (input.FirstName != null)
            provider.FirstName = input.FirstName.Trim();
        if (input.LastName != null)
            provider.LastName = input.LastName.Trim();
        if (input.Credentials != null)
            provider.Credentials = string.IsNullOrEmpty(input.Credentials) ? null : input.Credentials.Trim();
        if (input.Npi != null)
        {
            if (input.Npi != "" && !System.Text.RegularExpressions.Regex.IsMatch(input.Npi, @"^\d{10}$"))
                return BadRequest(new { error = "NPI must be exactly 10 digits." });

            var newNpi = string.IsNullOrEmpty(input.Npi) ? null : input.Npi.Trim();
            if (newNpi != null && newNpi != provider.Npi)
            {
                var npiExists = await _db.Providers.AnyAsync(p => p.Npi == newNpi && p.Id != id);
                if (npiExists)
                    return Conflict(new { error = "A provider with this NPI already exists." });
            }
            provider.Npi = newNpi;
        }
        if (input.Specialty != null)
            provider.Specialty = string.IsNullOrEmpty(input.Specialty) ? null : input.Specialty.Trim();
        if (input.AppUserId.HasValue)
            provider.AppUserId = input.AppUserId.Value == 0 ? null : input.AppUserId.Value;
        if (input.IsActive.HasValue)
            provider.IsActive = input.IsActive.Value;

        await _db.SaveChangesAsync();

        return Ok(ToResponse(provider));
    }

    private static ProviderResponseDto ToResponse(Provider provider)
    {
        return new ProviderResponseDto
        {
            Id = provider.Id.ToString(),
            FirstName = provider.FirstName,
            LastName = provider.LastName,
            Credentials = provider.Credentials,
            Npi = provider.Npi,
            Specialty = provider.Specialty,
            AppUserId = provider.AppUserId,
            IsActive = provider.IsActive,
            CreateDate = provider.CreateDate.ToString("O"),
            ModDate = provider.ModDate.ToString("O"),
        };
    }

    private sealed class ProviderResponseDto
    {
        public string Id { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string? Credentials { get; set; }
        public string? Npi { get; set; }
        public string? Specialty { get; set; }
        public int? AppUserId { get; set; }
        public bool IsActive { get; set; }
        public string CreateDate { get; set; } = "";
        public string ModDate { get; set; } = "";
    }

    public sealed class CreateProviderRequest
    {
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string? Credentials { get; set; }
        public string? Npi { get; set; }
        public string? Specialty { get; set; }
        public int? AppUserId { get; set; }
    }

    public sealed class UpdateProviderRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Credentials { get; set; }
        public string? Npi { get; set; }
        public string? Specialty { get; set; }
        public int? AppUserId { get; set; }
        public bool? IsActive { get; set; }
    }
}
