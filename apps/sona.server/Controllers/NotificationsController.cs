using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sona.Server.Data;
using Sona.Server.Data.DbModels;
using Sona.Server.Models.Commons;
using Sona.Server.Models.Messaging;
using Sona.Server.Models.Util;

namespace Sona.Server.Controllers;

[Authorize]
[ApiController]
public class NotificationsController : Controller
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAppUserUtil _appUserUtil;
    private readonly ISmsSender _smsSender;
    private readonly IPushSender _pushSender;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        ApplicationDbContext db,
        ICurrentUserService currentUserService,
        IAppUserUtil appUserUtil,
        ISmsSender smsSender,
        IPushSender pushSender,
        ILogger<NotificationsController> logger)
    {
        _db = db;
        _currentUserService = currentUserService;
        _appUserUtil = appUserUtil;
        _smsSender = smsSender;
        _pushSender = pushSender;
        _logger = logger;
    }

    // POST: /api/notifications/ready
    [HttpPost("/api/notifications/ready")]
    public async Task<IActionResult> NotifyReady([FromBody] NotifyReadyRequest input)
    {
        if (!int.TryParse(input.PatientId, out var patientId))
            return NotFound();

        var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == patientId);
        if (patient == null)
            return NotFound();
        if (!patient.IsActive)
            return BadRequest(new { error = "Patient is inactive." });

        var sender = await ResolveCurrentAppUserAsync();
        if (sender == null)
            return Unauthorized();

        var template = await _db.MessageTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Key == ConstantDefaults.MESSAGE_TEMPLATE_KEY_READY && t.IsActive);
        if (template == null)
        {
            _logger.LogError("Active message template '{TemplateKey}' not found — cannot send", ConstantDefaults.MESSAGE_TEMPLATE_KEY_READY);
            return StatusCode(500, new { error = "No active message template configured." });
        }

        var channel = patient.IsUsingMobileApp ? "push" : "sms";

        var message = new MessageOut
        {
            PatientId = patient.Id,
            SentByUserId = sender.Id,
            Channel = channel,
            MessageTemplateId = template.Id,
            Body = template.Body,
            MobileNumber = channel == "sms" ? patient.MobileNumber : null,
            Status = "pending",
        };

        // TCPA gate: never send SMS without consent. The attempt is still
        // audited as a failed MessageOut row (docs/compliance.md).
        if (channel == "sms" && !patient.SmsConsent)
        {
            message.Status = "failed";
            message.FailureReason = "sms-consent-missing";
            _db.MessagesOut.Add(message);
            await _db.SaveChangesAsync();

            _logger.LogWarning("Notification {MessageOutId} blocked: sms-consent-missing", message.Id);
            return Conflict(new { error = "Patient has not consented to SMS. Capture consent before notifying." });
        }

        // Persist the audit row BEFORE any dispatch — no fire-and-forget.
        _db.MessagesOut.Add(message);
        await _db.SaveChangesAsync();

        var result = channel == "push"
            ? await _pushSender.SendAsync(patient.Id, template.Body)
            : await _smsSender.SendAsync(patient.MobileNumber, template.Body);

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

        return CreatedAtAction(nameof(GetPatientNotifications), new { id = patient.Id.ToString() }, ToResponse(message));
    }

    // GET: /api/patients/{id}/notifications
    [HttpGet("/api/patients/{id}/notifications")]
    public async Task<IActionResult> GetPatientNotifications(string id)
    {
        if (!int.TryParse(id, out var patientId))
            return NotFound();

        var patientExists = await _db.Patients.AnyAsync(p => p.Id == patientId);
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
            PatientId = message.PatientId.ToString(),
            SentByUserId = message.SentByUserId,
            Channel = message.Channel,
            MessageTemplateId = message.MessageTemplateId?.ToString(),
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
        public string PatientId { get; set; } = "";
        public int SentByUserId { get; set; }
        public string Channel { get; set; } = "";
        public string? MessageTemplateId { get; set; }
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
    }
}
