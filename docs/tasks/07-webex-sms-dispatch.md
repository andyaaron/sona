# Task 07 — Real SMS dispatch via Webex Connect

**Prerequisite:** Task 03 merged (NotificationsController, `MessageOut` persistence, `ISmsSender` abstraction with a no-op stub). This task replaces the stub with a real Webex Connect implementation so the "Ready to be seen" button actually texts the patient's number.
Read `docs/tasks/_context.md`, `AGENTS.md`, and `docs/compliance.md` first.

## Current state

- `apps/sona.server/Models/Util/WebexUtil.cs` exists: `IWebexConnectUtil.SendSimpleSMS(to, message, fromOverride?)` posting to Webex Connect `POST {baseApiUrl}/v2/messages` (channel `sms`, header `key` = service key from Azure Key Vault secret `WebexConnectServiceKey`).
- **It is dead code:** not registered in DI, and no `WebexConnect` section exists in any appsettings file (`keyvaultUri`, `defaultFromSMS`, `baseApiUrl` all unset). It has never run.
- Task 03's send flow: persist `MessageOut` (`Status = pending`) → dispatch via `ISmsSender`/`IPushSender` → update status. Push stays a no-op stub (mobile app is Enhancement 2; every patient currently has `IsUsingMobileApp = false`, so in practice every notify goes SMS).
- Vendor decision: **Webex Connect replaces Twilio** in the docs' assumptions.

## Requirements

### 1. Wire up and harden `WebexConnectUtil` (audited defects — fix each while integrating)

**Defect 1 — not registered in DI:** register in `Program.cs` as a **singleton** (so Key Vault is hit once per process, not per request).

**Defect 2 — no config + constructor blocks/throws at startup:**
- Add the `WebexConnect` section (`keyvaultUri`, `baseApiUrl`, `defaultFromSMS`) to `appsettings.json` with empty placeholders. **The real values are being pulled from another app by the team** — leave a clearly-marked `TODO(config)` and document in `docs/getting-started.md` where they go (`appsettings.Development.json` / environment). The service key itself never lands in a settings file; it stays in Key Vault (`WebexConnectServiceKey`).
- Config presence resolves the *missing-config* throw, but **not** the whole defect: the constructor still does synchronous Key Vault I/O at startup, and any developer without Azure credentials/KV access (`DefaultAzureCredential`) still crashes the API even with config present. So additionally: move secret retrieval out of the constructor into a lazy, thread-safe first-send initialization (e.g. `Lazy<Task<string>>` or an async init guarded by a semaphore). Constructor only reads/validates config values. Unconfigured or KV-unreachable ⇒ the API still starts; sends fail cleanly with `FailureReason = "sms-not-configured"` and one structured warning — never an unhandled startup exception.

**Defect 3 — `new HttpClient()` per call** (socket exhaustion): inject `IHttpClientFactory`; use a named client (`"webex-connect"`) with `BaseAddress` from config and a sane timeout (~10s) registered in `Program.cs`. Must be fixed in this task, not deferred.

**Defect 4 — returns bare `bool`, Webex message id is discarded** (audit trail needs it for `MessageOut.ProviderMessageSid` and future delivery webhooks). Solution:
- Replace the return type with a result record in the util's namespace:
  ```csharp
  public sealed record SmsSendResult(bool Success, string? ProviderMessageId, string? FailureReason);
  ```
- On 2xx: parse the response JSON and capture the message/transaction identifier — **verify the exact field name against the Webex Connect v2 `/messages` API docs** (it is a request/transaction id in the ack body; do not guess from memory). Store it verbatim in `ProviderMessageId`.
- On non-2xx: `Success = false`, `FailureReason = $"webex-http-{(int)statusCode}"`. On exception: `"webex-exception"`. Unconfigured: `"sms-not-configured"`. Codes are short, machine-readable, PHI-free — they land in `MessageOut.FailureReason`.
- The caller (Task 03's send flow) maps `SmsSendResult` onto the `MessageOut` row: success ⇒ `sent` + `SentDateTime` + `ProviderMessageSid`; failure ⇒ `failed` + `FailureReason`.

**Defect 5 — PHI in logs** (current code logs the full Webex response body on non-success, which can echo the destination phone number; phone numbers identify patients). Solution:
- Add a correlation parameter to the send method (the `MessageOut` id) and make every log line follow the pattern: `"SMS send failed. messageOutId={MessageOutId} httpStatus={Status} webexErrorCode={Code}"` — where `webexErrorCode` is only the machine error `code`/`description` field parsed from the response JSON, never the raw body.
- Never log `toPhoneNumber`, the message text, or the raw request/response body at Information level or above. If a raw body is genuinely needed for debugging, log it at `Debug` only after redacting phone patterns (`Regex.Replace(body, @"\+?\d{7,15}", "[redacted]")`) — prefer not logging it at all.
- Sweep every log statement this task adds or touches (constructor included) against this rule and quote them in the final report (Definition of Done below).

### 2. Connect to the notification flow (Task 03's `ISmsSender`)

- Implement Task 03's `ISmsSender` with a `WebexSmsSender` that delegates to `IWebexConnectUtil` (or collapse the two interfaces if that's cleaner — one abstraction, not three). Message body comes from the rendered template (`MessageOut.Body`) — never any other string; `to` is the `MessageOut.MobileNumber` snapshot.
- Status wiring: success ⇒ `Status = sent`, `SentDateTime = UtcNow`, `ProviderMessageSid` set. Failure ⇒ `Status = failed`, `FailureReason` set (short machine-readable reason, no PHI). The `MessageOut` row must already exist as `pending` before the HTTP call (Task 03 invariant — verify, don't assume).
- The TCPA gate (`SmsConsent == false` ⇒ blocked, audited as `failed`) lives in the controller from Task 03 — do not duplicate it in the sender, but verify it's actually there.
- `defaultFromSMS` empty ⇒ treat as configuration failure at send time (`sms-not-configured`), since Webex rejects a missing `from`.

### 3. Docs

- `docs/architecture.md`: replace the Twilio reference with Webex Connect.
- `docs/compliance.md`: the vendor section says "SMS provider must sign a BAA — Twilio does" — update for Webex Connect and leave the checkbox unchecked with a note that **BAA status with Webex/Cisco must be confirmed before production traffic** (phone numbers tied to patient identity flow to the vendor). Flag this in your report too; it is a launch blocker decision, not a code change.
- `docs/getting-started.md`: how to configure `WebexConnect` locally (and that the API runs with SMS disabled when unconfigured).
- Tick this task in `docs/patient-tasks.md`.

## Out of scope

Delivery-status webhooks (`delivered`/`DeliveredDateTime` stay webhook-driven, future task), inbound SMS (`MessageIn`, Enhancement 1), push dispatch, retry/queueing (single synchronous attempt is acceptable for MVP), any change to message content or templates.

## Definition of Done

Per `_context.md`. Additionally: run the API locally **without** Webex config and prove it starts and a notify attempt records a clean `failed`/`sms-not-configured` outcome (this is testable without any Azure access); quote every log line added/changed in your report and confirm none contains a phone number, name, or message body.
