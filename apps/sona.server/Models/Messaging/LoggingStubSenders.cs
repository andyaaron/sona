namespace Sona.Server.Models.Messaging;

/// <summary>
/// No-op stand-in until Task 07 wires Webex Connect. Reports success without
/// dispatching anything. Never log the number or body — PHI rule.
/// </summary>
public class LoggingStubSmsSender : ISmsSender
{
    private readonly ILogger<LoggingStubSmsSender> _logger;

    public LoggingStubSmsSender(ILogger<LoggingStubSmsSender> logger)
    {
        _logger = logger;
    }

    public Task<DispatchResult> SendAsync(string mobileNumber, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Stub SMS dispatch invoked (no message actually sent)");
        return Task.FromResult(new DispatchResult(Success: true));
    }
}

/// <summary>No-op stand-in until the mobile app exists (Enhancement 2).</summary>
public class LoggingStubPushSender : IPushSender
{
    private readonly ILogger<LoggingStubPushSender> _logger;

    public LoggingStubPushSender(ILogger<LoggingStubPushSender> logger)
    {
        _logger = logger;
    }

    public Task<DispatchResult> SendAsync(int patientId, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Stub push dispatch invoked (no message actually sent)");
        return Task.FromResult(new DispatchResult(Success: true));
    }
}
