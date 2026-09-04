# Task 25 — Include appointment time and provider name in the SMS

**Status: proposed 2026-09-04 — ⚠️ COMPLIANCE-GATED. Do not implement until Q25.1 and Q25.2 are
answered in writing by whoever owns compliance sign-off.** AGENTS.md Golden Rule 1: "If a task
seems to require PHI in a message, stop and flag it instead of implementing." This file is that
flag.
**Depends on:** Task 22 (confirmed appointment-time column, practitioner name resolution, stable
appointment id) and Task 28 (templates with placeholders) — or the minimal placeholder support
described below if 28 is later.

Read `docs/tasks/_context.md`, `AGENTS.md` §0.1, `docs/compliance.md`, `docs/data-model.md`
(MessageOut / MessageTemplate PHI notes) and `NotificationsController.NotifyOpiePatient` first.

## Ask (colleague feedback, 2026-09-04)

> Include in txt message who they will see. Include time and provider name in appt. This should be
> an easy one. We will need to get the column name for the patient appt time, as well as complete
> investigation for getting provider data.

## Why it is not "easy" — the compliance position today

- `docs/compliance.md` → Notification content: "No PHI in any notification payload… Never include
  … provider specialty, clinic names that imply a condition". An appointment time tied to an
  identified phone number is PHI; a provider's name at a single-specialty clinic (the bound org is
  an Orthotics & Prosthetics clinic) can imply the condition category the same way a specialty
  does. SMS is unencrypted and visible on lock screens.
- `docs/data-model.md`: `MessageOut.Body` "must come from an approved template, never operator
  free-text". Today `MessageTemplate.Body` is a static string and the send path copies it
  verbatim (`GetActiveReadyTemplateAsync`). There is no placeholder rendering anywhere.
- The current message ("You're ready to be seen. Please come to the front desk.") is sent when
  the patient is *already at the clinic*. Adding "at 2:30 PM with Dr. Smith" to that message
  reads like a reminder, not a ready-ping — see Q25.3; this may really be a second message type.

## Proposed design (only after sign-off)

1. **Placeholders, server-rendered, from Opie data — never from the request body.**
   `POST /api/opie/notify` gains `scheduleId` (Task 22's stable appointment id). The server
   re-reads that appointment from Opie (`IOpieScheduleRepository.GetAppointmentAsync(scheduleId)`
   — new narrow query, still read-only) and renders `{appointmentTime}` (e.g. "2:30 PM", clinic
   local time) and `{providerName}` (Task 24's display rule: linked Sona `Provider` name, else
   Opie's). The client never sends the time or the name (a caller-supplied string is exactly the
   free-text hole the data model forbids).
2. **Template:** a new approved template key `ready-to-be-seen-with-appointment` (or a placeholder
   version of the existing one — Q25.4) whose body uses only whitelisted tokens. Rendering is a
   single `MessageTemplateRenderer` in `Models/Messaging/` with a token whitelist; unknown tokens
   fail the send (audited `failed` / `template-render-error`), never pass through. Task 28's
   template editor validates against the same whitelist.
3. **Audit:** `MessageOut.Body` keeps the rendered snapshot as today. `MessageOut` gains
   `OpieScheduleId` (string?) so the send is tied to the appointment (data-model.md already
   anticipates `EncounterId` for this). Migration + `docs/data-model.md`.
4. **Logging:** unchanged — counts/ids only; the rendered body is never logged.
5. **Fallback:** if the appointment cannot be re-read (Opie down, id not found) the send must
   **fail** with an audited `failed` / `appointment-not-found`, not fall back to the generic
   template silently — the sender chose a message that promises a time and provider.
6. **UI:** the confirm dialog shows the exact message that will be sent (`opie-notify-preview`,
   rendered client-side from the same template + the row's data, clearly labelled "Preview") so
   the sender sees the PHI they are about to put in an SMS. Guide updated.

## Tests (same task)

Renderer unit tests (server: xUnit project does not exist yet — add
`apps/sona.server.tests` or test through the controller if a test project is out of scope; say
which). Client: `notify-opie-button.test.tsx` preview text; e2e: `MessageOut.body` from
`GET /api/patients/{id}/notifications`-equivalent for Opie sends (there is no Opie history endpoint
yet — assert via the 201 body's `body` field).

## Non-goals

- No reminder scheduling (that is the v2 backlog item in `_backlog.md`).
- No patient first name in the message (Q25.2 covers names generally; the ask is provider name).

## Open questions (answer by number)

- **Q25.1 (blocking)** Who signs off on message content compliance, and have they approved
  including the appointment time and the provider's name in an SMS? `docs/compliance.md` has to
  be updated to say what is permitted before code changes.
- **Q25.2 (blocking)** Provider *name* only, or "Dr. Last"? Is "Dr." acceptable given it is a
  prosthetics/orthotics clinic (credentials like CPO instead of MD)? Any provider whose name
  should never appear?
- **Q25.3** Which message is this for: the existing "ready to be seen" ping (sent when the patient
  is on site), or a new pre-visit confirmation/reminder ("Your appointment is at 2:30 PM with
  …")? The wording "who they will see" suggests a reminder. If reminder: when is it sent and by
  whom (manual button per row, or scheduled)?
- **Q25.4** Replace the single `ready-to-be-seen` template with the richer text for everyone, or
  add a second template and let the sender pick (dialog radio)? Proposed: second template,
  sender picks, so the generic one remains available when a provider is unassigned.
- **Q25.5** Time format: "2:30 PM" local clinic time assumed. Include the date ("today at
  2:30 PM")? Confirm the source column is the patient-facing time (Task 22 §5).
