# Task 03 — Notifications backend (send + persist) and per-patient history UI

**Prerequisite:** Task 00 merged.
Read `docs/tasks/_context.md`, `AGENTS.md`, and `docs/compliance.md` first. This is the most compliance-sensitive task in the folder.

## Why this is bigger than the original task-list entry

`docs/patient-tasks.md` says "API endpoint `listForPatient` already exists" — **false on the server.** Both `notificationsApi.notifyReady` and `listForPatient` exist only in `packages/api-client`; there is no `NotificationsController`, and the `MessageOut`/`MessageTemplate` entity files under `Data/DbModels/Messaging/` are not registered (DbSets commented out in `ApplicationDbContext`). This task builds the real backend plus the history UI.

## Requirements

1. **Entities:** Review `Data/DbModels/Messaging/MessageOut.cs` and `MessageTemplate.cs` against the `MessagesOut`/`MessageTemplate` specs in `docs/data-model.md` and the `MessageOut` type in `packages/shared/src/types.ts`; reconcile field gaps (they were written pre-restructure — fix them). Both are NEW tables ⇒ `EntityBase` (Guid v7) per `_context.md`; if `ApplicationDbContext`'s timestamp stamping is still a TODO stub when you start (Task 02 not merged yet), implement it here. Uncomment/add both `DbSet`s. FKs: `MessageOut.PatientId → Patient` (**int** FK, Restrict), `MessageOut.SentByUserId → AppUser` (**int** FK — the contract's `sentByUserId: string` must become `number` to match; update any consumers), `MessageOut.MessageTemplateId → MessageTemplate` (Guid, nullable). Index on `PatientId`. One migration, seed one template row: key `ready-to-be-seen`, body `"You're ready to be seen. Please come to the front desk."`.
   - **Fix the latent contract bug while here:** `notifyPatientSchema` validates `patientId` with `.uuid()`, but real patient ids are int-strings (`"1"`) — the notify flow would reject every valid id. Change to a positive-integer-string rule (e.g. `z.string().regex(/^\d+$/)`), and keep `MessageOut.patientId`/`id` as strings in the contract (server maps int/Guid → string in the DTO, same as `PatientsController.ToResponse`).
2. **`POST /api/notifications/ready`** (new `NotificationsController`, `[Authorize]`):
   - Input `{ patientId }` (matches `notifyPatientSchema`). 404 unknown patient; 400 inactive patient.
   - Channel selection: `IsUsingMobileApp` ⇒ `push`, else `sms`.
   - **TCPA gate:** channel `sms` and `SmsConsent == false` ⇒ `409` with a clear non-PHI error; no row persisted? No — persist a `MessageOut` with `Status = failed`, `FailureReason = "sms-consent-missing"` so the attempt is audited, and still return 409.
   - Happy path: persist `MessageOut` (`Status = pending`, template id + rendered `Body` from the seeded template, `MobileNumber` snapshot for sms / null for push, `SentByUserId` from the authenticated user — resolve the current `AppUser` the same way existing controllers/`UserController` do) **before** any dispatch. Dispatch goes through a clearly-named abstraction (`ISmsSender`/`IPushSender` with logging no-op implementations registered in DI): the stub marks `Status = sent`, `SentDateTime = UtcNow` after persisting. Design `ISmsSender`'s result as `{ success, providerMessageId?, failureReason? }` — Task 07 drops in a real Webex Connect implementation (`Models/Util/WebexUtil.cs` exists but is unregistered dead code; do NOT wire it in this task).
   - Return the created `MessageOut` mapped to the shared contract shape.
   - ⚠️ PHI: log line may contain the MessageOut id and status ONLY — never patient name, phone, dob, or template body.
3. **`GET /api/patients/{id}/notifications`** — patient's `MessageOut` rows, newest first, contract-shaped; parse `id` the way `PatientsController.TryParseId` does. (Route lives fine on `NotificationsController` with an explicit route attribute, or `PatientsController` — pick one, keep controllers thin.)
4. **Contract:** `packages/shared` `MessageOut.sentByUserId` type fix (see §1); everything else should already line up — verify rather than assume. `packages/api-client` endpoints already exist; fix signatures if the contract changed.
5. **Client history UI:** per-patient notification history — add `features/notifications/api/get-patient-notifications.ts` (queryOptions keyed `['notifications', patientId]` — note `notify-patient.ts` already invalidates exactly that key) and a `features/notifications/components/` panel listing channel, status, sent/delivered times. Surface it from the patients list (expandable row or a small "History" toggle per row — simplest thing that works; there is no patient detail route yet).
6. **Docs:** update `docs/patient-tasks.md` (history checkbox + correct the "already exists" claim), `docs/data-model.md` if entity fields moved.

## Out of scope

Real SMS dispatch via Webex (Task 07) and Expo push dispatch, delivery webhooks (`ProviderMessageSid` stays null until Task 07), confirmation dialog (Task 04), `OnBehalfOfProviderId`.

## Definition of Done

Per `_context.md`. Compliance self-check in your report: quote every new log statement and the notification body path, confirming no PHI. Confirm a `MessageOut` row is written on every code path that attempts a send (incl. the consent-blocked path).
