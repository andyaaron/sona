using System.Text;
using System.Text.Json.Nodes;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

namespace Sona.Server.Models.Util;

/// <summary>
/// Outcome of a Webex Connect send attempt. FailureReason values are short,
/// machine-readable and PHI-free — they land in MessageOut.FailureReason.
/// </summary>
public sealed record SmsSendResult(bool Success, string? ProviderMessageId, string? FailureReason);

public interface IWebexConnectUtil
{
    /// <param name="messageOutId">MessageOut audit-row id — the only correlation key allowed in logs.</param>
    Task<SmsSendResult> SendSimpleSMS(Guid messageOutId, string toPhoneNumber, string message, string? optionalFromOverride = null, CancellationToken cancellationToken = default);
}

/// <summary>
/// Sends SMS via Webex Connect Send Message API v2 (POST {baseApiUrl}/v2/messages).
/// The service key lives in Key Vault (secret "WebexConnectServiceKey") and is
/// fetched lazily on first send — never in the constructor — so the API starts
/// even when Webex/Azure is unconfigured or unreachable; sends then fail cleanly
/// with "sms-not-configured".
/// PHI rule (docs/compliance.md): no log line here may contain the destination
/// number, the message text, or a raw request/response body.
/// </summary>
public class WebexConnectUtil : IWebexConnectUtil
{
    public const string HttpClientName = "webex-connect";

    private readonly ILogger<WebexConnectUtil> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string? _keyvaultUri;
    private readonly string? _defaultFromSMS;
    private readonly bool _isConfigured;

    private readonly SemaphoreSlim _keyLock = new(1, 1);
    private string? _serviceKey;

    public WebexConnectUtil(ILogger<WebexConnectUtil> logger, IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;

        var webexConnectConfig = config.GetSection("WebexConnect");
        _keyvaultUri = webexConnectConfig.GetValue<string>("keyvaultUri");
        _defaultFromSMS = webexConnectConfig.GetValue<string>("defaultFromSMS");
        var baseApiUrl = webexConnectConfig.GetValue<string>("baseApiUrl");

        _isConfigured = !string.IsNullOrWhiteSpace(_keyvaultUri) && !string.IsNullOrWhiteSpace(baseApiUrl);
        if (!_isConfigured)
        {
            _logger.LogWarning(
                "Webex Connect is not configured (WebexConnect:keyvaultUri and/or WebexConnect:baseApiUrl missing); SMS dispatch is disabled and sends will fail with sms-not-configured");
        }
    }

    public async Task<SmsSendResult> SendSimpleSMS(Guid messageOutId, string toPhoneNumber, string message, string? optionalFromOverride = null, CancellationToken cancellationToken = default)
    {
        var from = optionalFromOverride ?? _defaultFromSMS;

        // Webex rejects a missing "from", so an empty defaultFromSMS is a config failure too.
        if (!_isConfigured || string.IsNullOrWhiteSpace(from))
        {
            _logger.LogWarning("SMS send skipped: Webex Connect not configured. messageOutId={MessageOutId}", messageOutId);
            return new SmsSendResult(false, null, "sms-not-configured");
        }

        var serviceKey = await GetServiceKeyAsync(messageOutId, cancellationToken);
        if (serviceKey == null)
            return new SmsSendResult(false, null, "sms-not-configured");

        try
        {
            // Relative URI — BaseAddress comes from the named client registered in Program.cs.
            var req = new HttpRequestMessage(HttpMethod.Post, "v2/messages");
            req.Headers.Add("key", serviceKey);

            var body = new JsonObject
            {
                ["channel"] = "sms",
                ["from"] = from,
                ["to"] = new JsonArray { new JsonObject { ["msisdn"] = new JsonArray(toPhoneNumber) } },
                ["content"] = new JsonObject { ["type"] = "text", ["text"] = message },
            };

            req.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");

            var client = _httpClientFactory.CreateClient(HttpClientName);
            var response = await client.SendAsync(req, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "SMS send failed. messageOutId={MessageOutId} httpStatus={Status} webexErrorCode={Code}",
                    messageOutId,
                    (int)response.StatusCode,
                    ParseErrorCode(responseBody));
                return new SmsSendResult(false, null, $"webex-http-{(int)response.StatusCode}");
            }

            // Success ack body (Webex Connect Send Message API v2):
            // { "requestTimestamp": "...", "messageId": "...", "correlationId": "...", "status": "queued" }
            var providerMessageId = ParseMessageId(responseBody);
            if (providerMessageId == null)
            {
                _logger.LogWarning(
                    "SMS accepted but ack body had no messageId. messageOutId={MessageOutId} httpStatus={Status}",
                    messageOutId,
                    (int)response.StatusCode);
            }

            return new SmsSendResult(true, providerMessageId, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "SMS send threw. messageOutId={MessageOutId} exceptionType={ExceptionType}",
                messageOutId,
                ex.GetType().Name);
            return new SmsSendResult(false, null, "webex-exception");
        }
    }

    /// <summary>
    /// Lazy, thread-safe Key Vault fetch. Not memoized on failure so a transient
    /// KV outage doesn't poison SMS until process restart.
    /// </summary>
    private async Task<string?> GetServiceKeyAsync(Guid messageOutId, CancellationToken cancellationToken)
    {
        if (_serviceKey != null)
            return _serviceKey;

        await _keyLock.WaitAsync(cancellationToken);
        try
        {
            if (_serviceKey != null)
                return _serviceKey;

            var client = new SecretClient(new Uri(_keyvaultUri!), new DefaultAzureCredential());
            var secret = await client.GetSecretAsync("WebexConnectServiceKey", cancellationToken: cancellationToken);
            _serviceKey = secret.Value.Value;
            return _serviceKey;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Webex Connect service key retrieval from Key Vault failed; SMS send treated as unconfigured. messageOutId={MessageOutId} exceptionType={ExceptionType}",
                messageOutId,
                ex.GetType().Name);
            return null;
        }
        finally
        {
            _keyLock.Release();
        }
    }

    /// <summary>Only the machine "code" field from the Webex error JSON — never the raw body (it can echo the destination number).</summary>
    private static string? ParseErrorCode(string responseBody)
    {
        try
        {
            // ToString() tolerates the code arriving as either a JSON string or number.
            return JsonNode.Parse(responseBody)?["code"]?.ToString();
        }
        catch
        {
            return null;
        }
    }

    private static string? ParseMessageId(string responseBody)
    {
        try
        {
            return JsonNode.Parse(responseBody)?["messageId"]?.GetValue<string>();
        }
        catch
        {
            return null;
        }
    }
}
