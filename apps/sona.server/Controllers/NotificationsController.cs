using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sona.Server.Data;
using Sona.Server.Data.DbModels;
using Sona.Server.Models.Commons;
using Sona.Server.Models.Messaging;
using Sona.Server.Models.Util;

namespace Sona.Server.Controllers;

[Authorize(Policy = Sona.Server.Models.Auth.Policies.AssignedUser)]
[ApiController]
public class NotificationsController : Controller
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAppUserUtil _appUserUtil;
    private readonly ISmsSender _smsSender;
    private readonly IPushSender _pushSender;
    private readonly Models.Opie.OpieOptions _opieOptions;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        ApplicationDbContext db,
        ICurrentUserService currentUserService,
        IAppUserUtil appUserUtil,
        ISmsSender smsSender,
        IPushSender pushSender,
        Models.Opie.OpieOptions opieOptions,
        ILogger<NotificationsController> logger)
    {
        _db = db;
        _currentUserService = currentUserService;
        _appUserUtil = appUserUtil;
        _smsSender = smsSender;
        _pushSender = pushSender;
        _opieOptions = opieOptions;
        _logger = logger;
    }

    // POST: /api/notifications/ready
    [HttpPost("/api/notifications/ready")]
    public async Task<IActionResult> NotifyReady([FromBody] NotifyReadyRequest input)
    {
        if (!int.TryParse(input.PatientId, out var patientId))
            return NotFound();

        var currentUser = await _currentUserService.GetCurrentUserAsync();
        if (currentUser == null)
            return Unauthorized();

        var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == patientId);
        if (patient == null)
            return NotFound();

        // Tenant isolation (8c): the sender must share an org with the patient.
        // Cross-org id ⇒ 404, not 403 — don't leak existence.
        if (currentUser.Role != UserRoles.SystemAdmin
            && patient.OrganizationId != currentUser.OrganizationId)
            return NotFound();

        if (!patient.IsActive)
            return BadRequest(new { error = "Patient is inactive." });

        var sender = await ResolveCurrentAppUserAsync();
        if (sender == null)
            return Unauthorized();

        // Optional sender department (audit): must belong to the patient's org,
        // and staff may only use departments in their own access set.
        Guid? departmentId = null;
        if (input.DepartmentId.HasValue)
        {
            var departmentInOrg = await _db.Departments
                .AnyAsync(d => d.Id == input.DepartmentId.Value
                    && d.Site!.OrganizationId == patient.OrganizationId);
            if (!departmentInOrg)
                return BadRequest(new { error = "Unknown department." });

            if (currentUser.Role == UserRoles.Staff
                && !currentUser.DepartmentIds.Contains(input.DepartmentId.Value))
                return BadRequest(new { error = "You do not have access to this department." });

            departmentId = input.DepartmentId.Value;
        }

        var template = await GetActiveReadyTemplateAsync();
        if (template == null)
            return StatusCode(500, new { error = "No active message template configured." });

        var channel = patient.IsUsingMobileApp ? "push" : "sms";

        var message = new MessageOut
        {
            PatientId = patient.Id,
            SentByUserId = sender.Id,
            Channel = channel,
            MessageTemplateId = template.Id,
            DepartmentId = departmentId,
            Body = template.Body,
            MobileNumber = channel == "sms" ? patient.MobileNumber : null,
            Status = "pending",
        };

        // TCPA gate: never send SMS without consent. The attempt is still
        // audited as a failed MessageOut row (docs/compliance.md).
        if (channel == "sms" && !patient.SmsConsent)
        {
            await AuditConsentBlockedAsync(message);
            return Conflict(new { error = "Patient has not consented to SMS. Capture consent before notifying." });
        }

        await DispatchAsync(message, pushPatientId: channel == "push" ? patient.Id : null);

        return CreatedAtAction(nameof(GetPatientNotifications), new { id = patient.Id.ToString() }, ToResponse(message));
    }

    // POST: /api/opie/notify — "ready to be seen" to a patient on the external Opie schedule.
    // Opie patients have no Sona Patient row (docs/opie-odbc-integration.md §6), so the audit
    // row carries OpiePatientId instead of PatientId. SMS only: Opie patients cannot have the app.
    [HttpPost("/api/opie/notify")]
    public async Task<IActionResult> NotifyOpiePatient([FromBody] NotifyOpieRequest input)
    {
        var opiePatientId = input.OpiePatientId?.Trim();
        if (string.IsNullOrEmpty(opiePatientId) || opiePatientId.Length > 50
            || opiePatientId == Models.Opie.OpieOptions.PlaceholderPatientId)
            return BadRequest(new { error = "Invalid Opie patient id." });

        if (input.MobileNumber == null || !E164.IsMatch(input.MobileNumber))
            return BadRequest(new { error = "Mobile number must be E.164 format (+15551234567)." });

        if (!_opieOptions.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "opie-not-configured" });

        var currentUser = await _currentUserService.GetCurrentUserAsync();
        if (currentUser == null)
            return Unauthorized();

        // Same tenant gate as GET /api/opie/schedule: the Opie clinic's own org or system_admin.
        if (!_opieOptions.AllowsAccess(currentUser.Role, currentUser.OrganizationId))
            return NotFound(new { error = "opie-not-available" });

        var sender = await ResolveCurrentAppUserAsync();
        if (sender == null)
            return Unauthorized();

        // The department must belong to the org Opie is bound to (the clinic), not merely the sender's.
        Guid? departmentId = null;
        if (input.DepartmentId.HasValue)
        {
            var departmentInOrg = await _db.Departments
                .AnyAsync(d => d.Id == input.DepartmentId.Value
                    && d.Site!.OrganizationId == _opieOptions.OrganizationId);
            if (!departmentInOrg)
                return BadRequest(new { error = "Unknown department." });

            if (currentUser.Role == UserRoles.Staff
                && !currentUser.DepartmentIds.Contains(input.DepartmentId.Value))
                return BadRequest(new { error = "You do not have access to this department." });

            departmentId = input.DepartmentId.Value;
        }

        var template = await GetActiveReadyTemplateAsync();
        if (template == null)
            return StatusCode(500, new { error = "No active message template configured." });

        var message = new MessageOut
        {
            PatientId = null,
            OpiePatientId = opiePatientId,
            SmsConsentAttested = input.SmsConsentAttested,
            SentByUserId = sender.Id,
            Channel = "sms",
            MessageTemplateId = template.Id,
            DepartmentId = departmentId,
            Body = template.Body,
            MobileNumber = input.MobileNumber,
            Status = "pending",
        };

        // TCPA gate: Opie has no consent field, so the sender must attest it. Same
        // audited refusal as a Sona patient without consent.
        if (!input.SmsConsentAttested)
        {
            await AuditConsentBlockedAsync(message);
            return Conflict(new { error = "Confirm the patient has consented to SMS before notifying." });
        }

        await DispatchAsync(message, pushPatientId: null);

        return StatusCode(StatusCodes.Status201Created, ToResponse(message));
    }

    private static readonly System.Text.RegularExpressions.Regex E164 = new(@"^\+[1-9]\d{1,14}$");

    private async Task<MessageTemplate?> GetActiveReadyTemplateAsync()
    {
        var template = await _db.MessageTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Key == ConstantDefaults.MESSAGE_TEMPLATE_KEY_READY && t.IsActive);
        if (template == null)
            _logger.LogError("Active message template '{TemplateKey}' not found — cannot send", ConstantDefaults.MESSAGE_TEMPLATE_KEY_READY);
        return template;
    }

    private async Task AuditConsentBlockedAsync(MessageOut message)
    {
        message.Status = "failed";
        message.FailureReason = "sms-consent-missing";
        _db.MessagesOut.Add(message);
        await _db.SaveChangesAsync();

        _logger.LogWarning("Notification {MessageOutId} blocked: sms-consent-missing", message.Id);
    }

    /// <summary>Persists the audit row BEFORE any dispatch (no fire-and-forget), then records the outcome.</summary>
    private async Task DispatchAsync(MessageOut message, int? pushPatientId)
    {
        _db.MessagesOut.Add(message);
        await _db.SaveChangesAsync();

        var result = pushPatientId.HasValue
            ? await _pushSender.SendAsync(pushPatientId.Value, message.Body ?? "")
            : await _smsSender.SendAsync(message.Id, message.MobileNumber ?? "", message.Body ?? "");

        if (result.Success)
        {
            message.Status = "sent";
            message.SentDateTime = DateTime.UtcNow;
            message.ProviderMessageSid = result.ProviderMessageId;
        }
        else
        {
            message.Status = "failed";
            message.FailureReason = result.FailureReason ?? "dispatch-failed";
        }
        await _db.SaveChangesAsync();

        _logger.LogInformation("Notification {MessageOutId} status {Status}", message.Id, message.Status);
    }

    // GET: /api/patients/{id}/notifications
    [HttpGet("/api/patients/{id}/notifications")]
    public async Task<IActionResult> GetPatientNotifications(string id)
    {
        if (!int.TryParse(id, out var patientId))
            return NotFound();

        var currentUser = await _currentUserService.GetCurrentUserAsync();
        if (currentUser == null)
            return Unauthorized();

        // Tenant isolation (8c): history is only visible within the patient's org
        var patientExists = await _db.Patients.AnyAsync(p => p.Id == patientId
            && (currentUser.Role == UserRoles.SystemAdmin || p.OrganizationId == currentUser.OrganizationId));
        if (!patientExists)
            return NotFound();

        var messages = await _db.MessagesOut
            .AsNoTracking()
            .Where(m => m.PatientId == patientId)
            .OrderByDescending(m => m.CreateDate)
            .Select(m => ToResponse(m))
            .ToListAsync();

        return Ok(messages);
    }

    private async Task<AppUser?> ResolveCurrentAppUserAsync()
    {
        var currentUser = await _currentUserService.GetCurrentUserAsync();
        if (currentUser?.Hca34Id == null)
            return null;

        var appUser = await _appUserUtil.GetAppUser(currentUser.Hca34Id);
        // GetAppUser returns an empty AppUser (Id == 0) when the row is missing
        return appUser == null || appUser.Id == 0 ? null : appUser;
    }

    private static MessageOutResponseDto ToResponse(MessageOut message)
    {
        return new MessageOutResponseDto
        {
            Id = message.Id.ToString(),
            PatientId = message.PatientId?.ToString(),
            OpiePatientId = message.OpiePatientId,
            SmsConsentAttested = message.SmsConsentAttested,
            SentByUserId = message.SentByUserId,
            Channel = message.Channel,
            MessageTemplateId = message.MessageTemplateId?.ToString(),
            DepartmentId = message.DepartmentId?.ToString(),
            Body = message.Body,
            MobileNumber = message.MobileNumber,
            Status = message.Status,
            ProviderMessageSid = message.ProviderMessageSid,
            FailureReason = message.FailureReason,
            CreatedAt = message.CreateDate.ToString("O"),
            SentAt = message.SentDateTime?.ToString("O"),
            DeliveredAt = message.DeliveredDateTime?.ToString("O"),
        };
    }

    private sealed class MessageOutResponseDto
    {
        public string Id { get; set; } = "";
        public string? PatientId { get; set; }
        public string? OpiePatientId { get; set; }
        public bool SmsConsentAttested { get; set; }
        public int SentByUserId { get; set; }
        public string Channel { get; set; } = "";
        public string? MessageTemplateId { get; set; }
        public string? DepartmentId { get; set; }
        public string? Body { get; set; }
        public string? MobileNumber { get; set; }
        public string Status { get; set; } = "";
        public string? ProviderMessageSid { get; set; }
        public string? FailureReason { get; set; }
        public string CreatedAt { get; set; } = "";
        public string? SentAt { get; set; }
        public string? DeliveredAt { get; set; }
    }

    public sealed class NotifyReadyRequest
    {
        public string PatientId { get; set; } = "";

        /// <summary>Sender's department context (audit — MessageOut.DepartmentId). Optional.</summary>
        public Guid? DepartmentId { get; set; }
    }

    public sealed class NotifyOpieRequest
    {
        /// <summary>Opie fldPatientID — not a Sona patient id.</summary>
        public string OpiePatientId { get; set; } = "";

        /// <summary>E.164 number to dial, chosen by the caller from the Opie phone rows.</summary>
        public string MobileNumber { get; set; } = "";

        public Guid? DepartmentId { get; set; }

        /// <summary>TCPA: the sender attests the patient consented to SMS (Opie has no consent field).</summary>
        public bool SmsConsentAttested { get; set; }
    }
}
