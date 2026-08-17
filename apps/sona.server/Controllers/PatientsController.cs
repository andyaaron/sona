using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Sona.Api.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class PatientsController : Controller
{
    // GET: /api/patients
    [HttpGet]
    public IActionResult GetPatients()
    {
        var patients = MockPatients;
        return Ok(patients);
    }

    // GET: /api/patients/{id}
    [HttpGet("{id:guid}")]
    public IActionResult GetPatient(Guid id)
    {
        var patient = MockPatients.FirstOrDefault(p => p.Id == id);
        if (patient == null)
            return NotFound();
        return Ok(patient);
    }

    private static readonly List<MockPatientDto> MockPatients =
    [
        new()
        {
            Id = Guid.Parse("a1b2c3d4-0001-4000-8000-000000000001"),
            Mrn = "MRN-100001",
            FirstName = "Jane",
            LastName = "Doe",
            Dob = "1985-03-15",
            PhoneNumber = "+15551234567",
            SmsConsent = true,
            SmsConsentDate = "2025-06-01T10:00:00Z",
            HasApp = true,
            InCerner = true,
            ImportSource = "ui",
            IsActive = true,
        },
        new()
        {
            Id = Guid.Parse("a1b2c3d4-0002-4000-8000-000000000002"),
            Mrn = "MRN-100002",
            FirstName = "John",
            LastName = "Smith",
            Dob = "1972-11-28",
            PhoneNumber = "+15559876543",
            SmsConsent = true,
            SmsConsentDate = "2025-05-20T14:30:00Z",
            HasApp = false,
            InCerner = true,
            ImportSource = "flatfile",
            IsActive = true,
        },
        new()
        {
            Id = Guid.Parse("a1b2c3d4-0003-4000-8000-000000000003"),
            Mrn = "MRN-100003",
            FirstName = "Maria",
            LastName = "Garcia",
            Dob = "1990-07-04",
            PhoneNumber = "+15555550199",
            SmsConsent = false,
            SmsConsentDate = null,
            HasApp = false,
            InCerner = false,
            ImportSource = "ui",
            IsActive = true,
        },
        new()
        {
            Id = Guid.Parse("a1b2c3d4-0004-4000-8000-000000000004"),
            Mrn = "MRN-100004",
            FirstName = "Robert",
            LastName = "Johnson",
            Dob = "1968-01-22",
            PhoneNumber = "+15553334444",
            SmsConsent = true,
            SmsConsentDate = "2025-07-10T09:15:00Z",
            HasApp = true,
            InCerner = true,
            ImportSource = "cerner",
            IsActive = true,
        },
        new()
        {
            Id = Guid.Parse("a1b2c3d4-0005-4000-8000-000000000005"),
            Mrn = "MRN-100005",
            FirstName = "Emily",
            LastName = "Chen",
            Dob = "1995-12-10",
            PhoneNumber = "+15557778888",
            SmsConsent = true,
            SmsConsentDate = "2025-08-01T16:45:00Z",
            HasApp = true,
            InCerner = false,
            ImportSource = "flatfile",
            IsActive = false,
        },
    ];

    /// <summary>
    /// Temporary DTO matching the shared Patient contract.
    /// Will be replaced by real DB queries + AutoMapper/manual mapping.
    /// </summary>
    private sealed class MockPatientDto
    {
        public Guid Id { get; set; }
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
}
