namespace Sona.Server.Models.Messaging;

/// <summary>
/// Outcome of a dispatch attempt. ProviderMessageId is the vendor's correlation
/// key (SMS message SID / push ticket id) used later by delivery webhooks.
/// </summary>
public sealed record DispatchResult(bool Success, string? ProviderMessageId = null, string? FailureReason = null);

/// <summary>
/// SMS dispatch boundary. Task 07 supplies the real Webex Connect implementation;
/// until then a logging stub is registered. Callers must persist a MessageOut row
/// BEFORE invoking this (docs/compliance.md — no fire-and-forget sends).
/// </summary>
public interface ISmsSender
{
    Task<DispatchResult> SendAsync(string mobileNumber, string body, CancellationToken cancellationToken = default);
}

/// <summary>Push dispatch boundary (Enhancement 2 — Expo). Stub until then.</summary>
public interface IPushSender
{
    Task<DispatchResult> SendAsync(int patientId, string body, CancellationToken cancellationToken = default);
}
