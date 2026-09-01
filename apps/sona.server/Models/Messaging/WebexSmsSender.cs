using Sona.Server.Models.Util;

namespace Sona.Server.Models.Messaging;

/// <summary>
/// ISmsSender backed by Webex Connect. Thin adapter: all HTTP/Key Vault/logging
/// concerns live in WebexConnectUtil; this only maps SmsSendResult → DispatchResult.
/// </summary>
public class WebexSmsSender : ISmsSender
{
    private readonly IWebexConnectUtil _webex;

    public WebexSmsSender(IWebexConnectUtil webex)
    {
        _webex = webex;
    }

    public async Task<DispatchResult> SendAsync(Guid messageOutId, string mobileNumber, string body, CancellationToken cancellationToken = default)
    {
        var result = await _webex.SendSimpleSMS(messageOutId, mobileNumber, body, cancellationToken: cancellationToken);
        return new DispatchResult(result.Success, result.ProviderMessageId, result.FailureReason);
    }
}
