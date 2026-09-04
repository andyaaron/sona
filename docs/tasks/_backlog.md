# Backlog — ideas parked on purpose (not scheduled)

Items here have been discussed and deliberately deferred. Promote one by writing a numbered task
file in this folder.

## New-patient paperwork reminder (v2) — added 2026-09-04

**Ask (colleague feedback):** "Reminder message to complete new patient paperwork. This would be a
message template."

**Shape when picked up:** a second template kind (`new-patient-paperwork`, Task 28 model) sent
before the visit to patients flagged as new. Open points to settle then: how "new patient" is
known (Opie field? — Task 22 may find one), trigger (manual button on the row vs scheduled N days
before the appointment — scheduling needs a background job Sona does not have yet), and the link:
a paperwork URL in an SMS must carry **no PHI or patient identifier in the query string**
(AGENTS.md rule 0.1; a per-send opaque token is the usual answer). Depends on Task 28 (templates
with approval) and, if the message names the appointment time, on Task 25's compliance sign-off.

## Visit wait-time analytics — added 2026-09-04

Once Task 27's `AppointmentVisitEvents` exist, time-in-state (arrived → ready → with nurse …)
is derivable. Not asked for yet; note only.
