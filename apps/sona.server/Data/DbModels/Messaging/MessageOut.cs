using Sona.Server.Data;

namespace Sona.Server.Data.DbModels;

/// <summary>
/// Outbound "ready to be seen" message to a patient. This IS the audit log for
/// sends: every send path writes a row here before dispatch — no fire-and-forget
/// (docs/compliance.md). Body is a snapshot of an approved MessageTemplate
/// render; nothing may write caller-supplied free text here.
/// </summary>
public class MessageOut : EntityBase
{
    /// <summary>
    /// When this send attempt was recorded. Same column name as the old EntityBase field so
    /// existing rows keep their values; now stamped at construction (not by the generic
    /// EntityBase mechanism, which was removed) because this row IS the compliance audit
    /// trail and the admin notification history relies on it for ordering/display even
    /// for attempts that never reach <see cref="SentDateTime"/> (e.g. consent-blocked).
    /// </summary>
    public DateTime CreateDate { get; set; } = DateTime.UtcNow;

    /// <summary>Sona patient. Null for sends made from the Opie schedule (see <see cref="OpiePatientId"/>).</summary>
    public int? PatientId { get; set; }
    public Patient? Patient { get; set; }

    /// <summary>
    /// Opie fldPatientID when the recipient came from the external Opie schedule — a separate
    /// identity space from <see cref="PatientId"/>. Kept so these rows can be linked to a Sona
    /// patient once an Opie↔Sona mapping exists (docs/opie-odbc-integration.md §6).
    /// </summary>
    public string? OpiePatientId { get; set; }

    /// <summary>
    /// TCPA: Opie has no consent field, so the sender attests consent at send time and that
    /// attestation is audited here. Always false for Sona patients (consent lives on Patient).
    /// </summary>
    public bool SmsConsentAttested { get; set; }

    public int SentByUserId { get; set; }
    public AppUser? SentByUser { get; set; }

    /// <summary>One of: sms, push. MVP is always sms.</summary>
    public required string Channel { get; set; }

    public Guid? MessageTemplateId { get; set; }
    public MessageTemplate? MessageTemplate { get; set; }

    /// <summary>
    /// Sender's department at send time (audit). Opaque id only — a department
    /// name can imply a condition and must never reach payloads/logs/URLs.
    /// </summary>
    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }

    /// <summary>Rendered template text as actually sent — audit snapshot, never free text.</summary>
    public string? Body { get; set; }

    /// <summary>Number dialed at send time (patients change numbers later). Null for push.</summary>
    public string? MobileNumber { get; set; }

    /// <summary>One of: pending, sent, delivered, failed.</summary>
    public required string Status { get; set; }

    /// <summary>Webex Connect messageId / push ticket id — correlation key for delivery webhooks.</summary>
    public string? ProviderMessageSid { get; set; }

    public string? FailureReason { get; set; }

    public DateTime? SentDateTime { get; set; }

    public DateTime? DeliveredDateTime { get; set; }
}
