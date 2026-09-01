using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sona.Server.Data;
using Sona.Server.Data.DbModels;
using PatientEntity = Sona.Server.Data.DbModels.Patient;

namespace Sona.Server.Controllers;

[Authorize(Policy = Sona.Server.Models.Auth.Policies.AssignedUser)]
[Route("api/[controller]")]
[ApiController]
public class PatientsController : Controller
{
    private readonly ApplicationDbContext _db;

    public PatientsController(ApplicationDbContext db)
    {
        _db = db;
    }

    // GET: /api/patients?providerId={guid}&page=1&pageSize=25&sortBy=lastName&sortDir=asc&search=...
    [HttpGet]
    public async Task<IActionResult> GetPatients(
        [FromQuery] Guid? providerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string sortBy = "lastName",
        [FromQuery] string sortDir = "asc",
        [FromQuery] string? search = null)
    {
        // Clamp, don't error (per task contract).
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > 100) pageSize = 100;

        var descending = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);
        if (!descending && !string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Invalid sortDir. Allowed: asc, desc." });

        var query = _db.Patients
            .AsNoTracking()
            .Include(p => p.PrimaryProvider)
            .Where(patient => patient.IsActive);

        if (providerId.HasValue)
            query = query.Where(patient => patient.PrimaryProviderId == providerId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(patient =>
                patient.Mrn.ToLower().Contains(term)
                || patient.FirstName.ToLower().Contains(term)
                || patient.LastName.ToLower().Contains(term));
        }

        // Ordering is a whitelist switch — never built from raw user input.
        // Secondary key LastName, FirstName keeps paging stable when the primary is non-unique.
        IOrderedQueryable<PatientEntity>? ordered = sortBy switch
        {
            "lastName" => descending
                ? query.OrderByDescending(p => p.LastName).ThenBy(p => p.FirstName)
                : query.OrderBy(p => p.LastName).ThenBy(p => p.FirstName),
            "firstName" => descending
                ? query.OrderByDescending(p => p.FirstName).ThenBy(p => p.LastName)
                : query.OrderBy(p => p.FirstName).ThenBy(p => p.LastName),
            "mrn" => descending
                ? query.OrderByDescending(p => p.Mrn).ThenBy(p => p.LastName).ThenBy(p => p.FirstName)
                : query.OrderBy(p => p.Mrn).ThenBy(p => p.LastName).ThenBy(p => p.FirstName),
            "dob" => descending
                ? query.OrderByDescending(p => p.Dob).ThenBy(p => p.LastName).ThenBy(p => p.FirstName)
                : query.OrderBy(p => p.Dob).ThenBy(p => p.LastName).ThenBy(p => p.FirstName),
            _ => null,
        };
        if (ordered == null)
            return BadRequest(new { error = "Invalid sortBy. Allowed: lastName, firstName, mrn, dob." });

        var totalCount = await query.CountAsync();

        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(patient => ToResponse(patient))
            .ToListAsync();

        return Ok(new PagedResultDto
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
        });
    }

    // GET: /api/patients/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPatient(string id)
    {
        if (!TryParseId(id, out var patientId))
            return NotFound();

        var patient = await _db.Patients
            .AsNoTracking()
            .Include(p => p.PrimaryProvider)
            .Where(existingPatient => existingPatient.Id == patientId && existingPatient.IsActive)
            .Select(existingPatient => ToResponse(existingPatient))
            .FirstOrDefaultAsync();

        if (patient == null)
            return NotFound();

        return Ok(patient);
    }

    // POST: /api/patients
    [HttpPost]
    public async Task<IActionResult> CreatePatient([FromBody] CreatePatientRequest input)
    {
        var mrnExists = await _db.Patients.AnyAsync(p =>
            p.Mrn == input.Mrn && p.IsActive);
        if (mrnExists)
            return Conflict(new { error = "A patient with this MRN already exists." });

        Guid? primaryProviderId = null;
        if (input.PrimaryProviderId.HasValue)
        {
            var provider = await _db.Providers.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == input.PrimaryProviderId.Value);
            if (provider == null)
                return BadRequest(new { error = "Provider not found." });
            if (!provider.IsActive)
                return BadRequest(new { error = "Cannot assign an inactive provider." });
            primaryProviderId = provider.Id;
        }

        var now = DateTime.UtcNow;
        var patient = new PatientEntity
        {
            Mrn = input.Mrn,
            FirstName = input.FirstName,
            LastName = input.LastName,
            Dob = DateOnly.Parse(input.Dob),
            MobileNumber = input.PhoneNumber,
            SmsConsent = input.SmsConsent,
            SmsConsentDate = input.SmsConsent ? now : null,
            IsUsingMobileApp = false,
            InCerner = false,
            ImportSource = "ui",
            IsActive = true,
            PrimaryProviderId = primaryProviderId,
        };

        _db.Patients.Add(patient);
        await _db.SaveChangesAsync();

        // Reload with provider navigation for response
        await _db.Entry(patient).Reference(p => p.PrimaryProvider).LoadAsync();

        return CreatedAtAction(nameof(GetPatient), new { id = patient.Id }, ToResponse(patient));
    }

    // PUT: /api/patients/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePatient(string id, [FromBody] UpdatePatientRequest input)
    {
        if (id != input.Id || !TryParseId(id, out var patientId))
            return BadRequest();

        var patient = await _db.Patients
            .Include(p => p.PrimaryProvider)
            .FirstOrDefaultAsync(existingPatient =>
                existingPatient.Id == patientId && existingPatient.IsActive);
        if (patient == null)
            return NotFound();

        if (input.Mrn != null)
        {
            var mrnTaken = await _db.Patients.AnyAsync(p =>
                p.Mrn == input.Mrn && p.IsActive && p.Id != patientId);
            if (mrnTaken)
                return Conflict(new { error = "A patient with this MRN already exists." });
            patient.Mrn = input.Mrn;
        }
        if (input.FirstName != null)
            patient.FirstName = input.FirstName;
        if (input.LastName != null)
            patient.LastName = input.LastName;
        if (input.Dob != null)
            patient.Dob = DateOnly.Parse(input.Dob);
        if (input.PhoneNumber != null)
            patient.MobileNumber = input.PhoneNumber;
        if (input.SmsConsent.HasValue)
        {
            patient.SmsConsent = input.SmsConsent.Value;
            patient.SmsConsentDate = input.SmsConsent.Value
                ? patient.SmsConsentDate ?? DateTime.UtcNow
                : null;
        }
        if (input.PrimaryProviderId.HasValue)
        {
            if (input.PrimaryProviderId.Value == Guid.Empty)
            {
                patient.PrimaryProviderId = null;
                patient.PrimaryProvider = null;
            }
            else
            {
                var provider = await _db.Providers.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == input.PrimaryProviderId.Value);
                if (provider == null)
                    return BadRequest(new { error = "Provider not found." });
                if (!provider.IsActive)
                    return BadRequest(new { error = "Cannot assign an inactive provider." });
                patient.PrimaryProviderId = provider.Id;
                // Reload navigation for response
                await _db.Entry(patient).Reference(p => p.PrimaryProvider).LoadAsync();
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ToResponse(patient));
    }

    // DELETE: /api/patients/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePatient(string id)
    {
        if (!TryParseId(id, out var patientId))
            return NotFound();

        var patient = await _db.Patients.FirstOrDefaultAsync(existingPatient =>
            existingPatient.Id == patientId && existingPatient.IsActive);
        if (patient == null)
            return NotFound();

        patient.IsActive = false;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private static bool TryParseId(string id, out int patientId)
    {
        return int.TryParse(id, out patientId);
    }

    // @TODO: Look into moving Dtos
    private static PatientResponseDto ToResponse(PatientEntity patient)
    {
        string? providerName = null;
        if (patient.PrimaryProvider != null)
        {
            providerName = string.IsNullOrEmpty(patient.PrimaryProvider.Credentials)
                ? $"{patient.PrimaryProvider.FirstName} {patient.PrimaryProvider.LastName}"
                : $"{patient.PrimaryProvider.FirstName} {patient.PrimaryProvider.LastName}, {patient.PrimaryProvider.Credentials}";
        }

        return new PatientResponseDto
        {
            Id = patient.Id.ToString(),
            Mrn = patient.Mrn,
            FirstName = patient.FirstName,
            LastName = patient.LastName,
            Dob = patient.Dob.ToString("yyyy-MM-dd"),
            PhoneNumber = patient.MobileNumber,
            SmsConsent = patient.SmsConsent,
            SmsConsentDate = patient.SmsConsentDate?.ToUniversalTime().ToString("O"),
            HasApp = patient.IsUsingMobileApp,
            InCerner = patient.InCerner,
            ImportSource = patient.ImportSource,
            IsActive = patient.IsActive,
            PrimaryProviderId = patient.PrimaryProviderId?.ToString(),
            PrimaryProviderName = providerName,
        };
    }

    // Mirrors PagedResult<T> in packages/shared (types.ts)
    private sealed class PagedResultDto
    {
        public List<PatientResponseDto> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
    }

    private sealed class PatientResponseDto
    {
        public string Id { get; set; } = "";
        public string Mrn { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string Dob { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public bool SmsConsent { get; set; }
        public string? SmsConsentDate { get; set; }
        public bool HasApp { get; set; }
        public bool InCerner { get; set; }
        public string ImportSource { get; set; } = "";
        public bool IsActive { get; set; }
        public string? PrimaryProviderId { get; set; }
        public string? PrimaryProviderName { get; set; }
    }

    public sealed class CreatePatientRequest
    {
        public string Mrn { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string Dob { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public bool SmsConsent { get; set; }
        public Guid? PrimaryProviderId { get; set; }
    }

    public sealed class UpdatePatientRequest
    {
        public string Id { get; set; } = "";
        public string? Mrn { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Dob { get; set; }
        public string? PhoneNumber { get; set; }
        public bool? SmsConsent { get; set; }
        public Guid? PrimaryProviderId { get; set; }
    }
}
