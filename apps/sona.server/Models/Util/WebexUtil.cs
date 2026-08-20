using System.Text.Json.Nodes;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

namespace Sona.Server.Models.Util;

public interface IWebexConnectUtil
{
    Task<bool> SendSimpleSMS(string toPhoneNumber, string message, string? optionalFromOverride = null);
}

public class WebexConnectUtil : IWebexConnectUtil
{
    private readonly ILogger<WebexConnectUtil> _logger;
    private readonly string? _serviceKey;
    private readonly string? _defaultFromSMS;
    private readonly string? _baseApiUrl;

    public WebexConnectUtil(ILogger<WebexConnectUtil> logger, IConfiguration config)
    {
        _logger = logger;
        var webexConnectConfig = config.GetSection("WebexConnect");

        var keyvaultUri = webexConnectConfig.GetValue<string>("keyvaultUri");

        if (string.IsNullOrEmpty(keyvaultUri))
        {
            _logger.LogError("keyvaultUri is not configured in appsettings.json");
            throw new ArgumentNullException("WebexConnect:keyvaultUri is not configured in appsettings.json");
        }

        try
        {
            var client = new SecretClient(new Uri(keyvaultUri), new DefaultAzureCredential());
            KeyVaultSecret secret = client.GetSecret("WebexConnectServiceKey");
            _serviceKey = secret.Value;

            _defaultFromSMS = webexConnectConfig.GetValue<string>("defaultFromSMS");
            if (string.IsNullOrEmpty(_defaultFromSMS))
            {
                _logger.LogWarning(
                    "WebexConnect env var defaultFromSMS is empty. Continuing as this is not necessarily required.");
            }

            _baseApiUrl = webexConnectConfig.GetValue<string>("baseApiUrl");
            if (string.IsNullOrEmpty(_baseApiUrl))
            {
                _logger.LogError("No baseApiUrl found in WebexConnect:baseApiUrl, throwing as this is required");
                throw new Exception("Required config value baseApiUrl not retrieved");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(
                "Error retrieving WebexConnect config from KeyVault: {Message}", ex.Message);
            throw;
        }
    }

    /// <summary>
    /// Send a simple SMS message via the Webex Connect API v2 SMS channel.
    /// </summary>
    public async Task<bool> SendSimpleSMS(string toPhoneNumber, string message, string? optionalFromOverride = null)
    {
        var from = optionalFromOverride ?? _defaultFromSMS;

        try
        {
            var req = new HttpRequestMessage();
            req.RequestUri = new Uri(_baseApiUrl + "/v2/messages");
            req.Method = HttpMethod.Post;

            req.Headers.Add("key", _serviceKey);

            var body = new JsonObject
            {
                ["channel"] = "sms",
                ["from"] = from,
                ["to"] = new JsonArray { new JsonObject { ["msisdn"] = new JsonArray(toPhoneNumber) } },
                ["content"] = new JsonObject { ["type"] = "text", ["text"] = message },
            };

            req.Content = new StringContent(body.ToJsonString());
            req.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

            using var client = new HttpClient();
            var response = await client.SendAsync(req);

            if (response.StatusCode != System.Net.HttpStatusCode.Created
                && response.StatusCode != System.Net.HttpStatusCode.OK
                && response.StatusCode != System.Net.HttpStatusCode.Accepted)
            {
                _logger.LogWarning(
                    "SMS send returned unexpected status: {StatusCode} : {Body}",
                    response.StatusCode,
                    await response.Content.ReadAsStringAsync());
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError("WebexConnect exception thrown in SendSimpleSMS: {Exception}", ex);
            return false;
        }
    }
}
