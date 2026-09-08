# Task 26 — Opie day sheet: show a row as notified after the text is sent

**Status: proposed 2026-09-04.** First slice of the check-in flow (Task 27). If Task 27 is
scheduled immediately, fold this into it; otherwise ship this alone — it needs no new table.
**Depends on:** Task 22 Part B (stable `scheduleId`) for exact per-appointment matching; can ship
before it with per-patient-per-day matching (see "Matching").

Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/admin-ui-guide.md` (Dashboard → Interactions
2) and `NotificationsController.NotifyOpiePatient` first.

## Ask (colleague feedback, 2026-09-04)

> Once patient is checked in, update row, highlight it a diff color… change notify button to say
> 'checked in' or 'confirmed'.

Read as: after a "ready to be seen" SMS is sent for a row, the row should visibly change state
and the button should stop offering to send again. ("Checked in" as the label conflicts with
Task 27's state names, where "checked in" is a front-desk paperwork step — see Q26.1.)

## Target behaviour

- **Server:** `GET /api/opie/schedule` returns, per appointment, `lastNotification:
  { status: MessageStatus, sentDateTime: string | null, messageOutId: string } | null` — the
  most recent `MessagesOut` row for that appointment (see Matching), org-scoped like everything
  else. Contract: `OpieAppointment.lastNotification` in `packages/shared`, fixtures + MSW handlers
  updated. One EF query for the day's `OpiePatientId`s, assembled in code.
- **Row (`opie-schedule-row-<key>`):** when `lastNotification` exists and `status !== 'failed'`,
  the row gets a distinct background (`bg-emerald-50`, text unchanged) **and** a text cue — a
  small "NOTIFIED" badge in the Patient cell styled like the "INTERNAL" badge, with title
  "Notified at {time}". Colour is never the only cue (same rule as internal blocks).
  A `failed` last notification shows a red "FAILED" badge with the `failureReason` in the title and
  leaves the button active.
- **Button:** replaced by a secondary, disabled-looking `Notified {h:mm a}` (`opie-notified-<key>`)
  with a small **Send again** text link (`opie-notify-again-<key>`) that opens the same confirm
  dialog (title prefixed "Send again: …"). Re-sends are allowed but deliberate — Q26.2.
- **Optimistic update:** on mutation success (`201` with `status !== 'failed'`) set the row's
  `lastNotification` in the query cache (`setQueryData` on `opieScheduleQueryOptions`) so the
  row flips immediately, then invalidate. On `failed` show the FAILED badge from the response.
- **Counts:** `opie-schedule-summary` gains `opie-schedule-count-notified` "K notified" (grey,
  clickable like the internal chip → toggles hiding notified rows so staff can see who is still
  waiting). Only rendered when K > 0.
- **Persistence across reload / devices:** comes from the server field, so a second front-desk
  machine sees the state on its next refetch. Set `refetchInterval: 30_000` on the schedule
  query while the shown date is today (`refetchIntervalInBackground: false`) — Q26.3.

## Matching (which MessagesOut row belongs to which appointment)

- With Task 22: `MessagesOut.OpieScheduleId == appointment.scheduleId` (add the column here if
  Task 25 has not; migration `MessagesOutOpieScheduleId`, `docs/data-model.md`).
- Without Task 22 (interim): `MessagesOut.OpiePatientId == patient.opiePatientId` and
  `CreateDate` on the sheet's date (clinic local). A patient booked twice that day shows both
  rows as notified — acceptable interim; state it in the guide.

## Testids

`opie-notified-<key>` · `opie-notify-again-<key>` · `opie-schedule-notified-badge-<key>` ·
`opie-schedule-failed-badge-<key>` · `opie-schedule-count-notified`. Register in the guide.

## Tests (same task)

- `day-sheet.test.ts`: notified count; hide-notified filter.
- `opie-day-sheet.test.tsx`: notified row renders badge + `Notified` control, failed row keeps
  the button.
- `notify-opie-button.test.tsx`: success flips the cache (row re-renders as notified without a
  refetch); failed response shows FAILED.
- e2e (`@smoke`, skips without Opie): notify → row shows NOTIFIED → reload → still notified
  (server-persisted).

## Docs (same commit)

Guide: row description, button states, new chip, interaction 2 (post-send state), the
30-second refresh; `docs/opie-odbc-integration.md` §8 contract row; `docs/data-model.md` if the
column is added. Verify in the running app (Local: sends are `failed` / `sms-not-configured` —
the FAILED path is what Local can exercise; say so in the report).

## Non-goals

- No state machine, no arrived/roomed/etc. — Task 27.
- No delivery-receipt polling (status stays whatever the webhook path sets).

## Open questions (answer by number)

- **Q26.1** Button label after a send: "Notified" (proposed — it says what happened), or the
  ask's "Checked in" / "Confirmed"? In Task 27's vocabulary those are different steps.
- **Q26.2** May staff re-send to the same appointment? Proposed: yes via an explicit "Send again"
  link (audited as a second MessageOut). If no, the button is simply gone after one send.
- **Q26.3** Is a 30-second background refetch of the day's schedule acceptable load on Opie
  (one live query per open dashboard per 30 s)? Alternative: refetch only on window focus.
- **Q26.4** Should notified rows be hideable (the "K notified" chip toggle) or just tinted?
