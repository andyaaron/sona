using Sona.Api.Data;

namespace Sona.Api.Features.Patients;

/// <summary>
/// Patient demographics, ingested via flat-file import, manual UI entry, or
/// (later) Cerner. FIN is deliberately absent — it is an encounter-level
/// identifier and belongs on the future Encounter table (docs/data-model.md).
/// </summary>
public class Patient : EntityBase
{
    /// <summary>Person-level medical record number. Unique business identifier.</summary>
    public required string Mrn { get; set; }

    public required string FirstName { get; set; }

    public required string LastName { get; set; }

    public DateOnly Dob { get; set; }

    /// <summary>E.164 format (+15551234567), normalized before persistence.</summary>
    public required string MobileNumber { get; set; }

    /// <summary>TCPA: no SMS may be sent while false.</summary>
    public bool SmsConsent { get; set; }

    public DateTime? SmsConsentDate { get; set; }

    public bool IsUsingMobileApp { get; set; }

    public bool InCerner { get; set; }

    /// <summary>One of: flatfile, ui, cerner — which ingest path last wrote this row.</summary>
    public required string ImportSource { get; set; }

    /// <summary>Soft delete — patient rows are never hard-deleted (audit trail).</summary>
    public bool IsActive { get; set; } = true;
}
