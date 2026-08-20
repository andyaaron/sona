using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sona.Server.Data;
using PatientEntity = Sona.Server.Data.DbModels.Patient;

namespace Sona.Server.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class PatientsController : Controller
{
    private readonly ApplicationDbContext _db;

    public PatientsController(ApplicationDbContext db)
    {
        _db = db;
    }

    // GET: /api/patients
    [HttpGet]
    public async Task<IActionResult> GetPatients()
    {
        var patients = await _db.Patients
            .AsNoTracking()
            .Where(patient => patient.IsActive)
            .OrderBy(patient => patient.LastName)
            .ThenBy(patient => patient.FirstName)
            .Select(patient => ToResponse(patient))
            .ToListAsync();

        return Ok(patients);
    }

    // GET: /api/patients/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPatient(string id)
    {
        if (!TryParseId(id, out var patientId))
            return NotFound();

        var patient = await _db.Patients
            .AsNoTracking()
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
        };

        _db.Patients.Add(patient);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPatient), new { id = patient.Id }, ToResponse(patient));
    }

    // PUT: /api/patients/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePatient(string id, [FromBody] UpdatePatientRequest input)
    {
        if (id != input.Id || !TryParseId(id, out var patientId))
            return BadRequest();

        var patient = await _db.Patients.FirstOrDefaultAsync(existingPatient =>
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

    private static PatientResponseDto ToResponse(PatientEntity patient)
    {
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
        };
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
    }

    public sealed class CreatePatientRequest
    {
        public string Mrn { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string Dob { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public bool SmsConsent { get; set; }
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
    }
}
