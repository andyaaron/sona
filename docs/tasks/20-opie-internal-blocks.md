# Task 20 — Show Opie internal schedule blocks (LUNCH, etc.) on the day sheet

Read `docs/tasks/_context.md`, `AGENTS.md`, and `docs/opie-odbc-integration.md` first.

## Background — how `-9999` is currently filtered (found while scoping this task)

Staff book internal time blocks (lunch, meetings, out-of-office) in Opie against a shared
placeholder patient, `fldPatientID = -9999` (`OpieOptions.PlaceholderPatientId` server-side,
`OPIE_PLACEHOLDER_PATIENT_ID` in `packages/shared/src/schemas.ts` client-side). It is dropped
**twice**, both of which currently discard the row entirely instead of redacting it:

1. **Server** (`apps/sona.server/Models/Opie/OpieScheduleRepository.cs`, `ReadKey`): every id
   column read from Opie (`fldPatientSchedulePatientID`, `fldPatientPhoneNumberPatientID`,
   `fldPatientID`) goes through the same helper, which returns `null` for `-9999`. Callers all
   do `if (patientId == null) continue;`, so the placeholder's appointments, phone rows, *and*
   its `tblPatients` demographic row (including `fldPatientComment` — where "LUNCH" etc. lives)
   never make it into the `OpieScheduledPatient` list returned to the client.
2. **Client** (`apps/sona.client/src/features/opie-schedule/day-sheet.ts`, `buildDaySheet`):
   belt-and-suspenders — `if (patient.opiePatientId === OPIE_PLACEHOLDER_PATIENT_ID) continue`
   before rows are built. Redundant today (server already strips it) but keep it removed
   deliberately per §1 below, not left as dead code.

`notifyOpiePatientSchema` also `.refine()`s that `opiePatientId !== OPIE_PLACEHOLDER_PATIENT_ID`,
and the notify endpoint enforces it server-side — **that rejection must not change** (§1).

## Goal

Internal blocks are real booked time on the sheet — hiding them makes gaps look like open slots
that aren't. Show one row per block, time-ordered like any appointment, clearly **not** a
patient row: no name/contact, the block's comment (e.g. "LUNCH") in place of patient info, no
notify action, and a visually distinct (highlighted) row style.

## Requirements

### 1. Server — stop discarding the placeholder row, redact it instead

`apps/sona.server/Models/Opie/OpieScheduleRepository.cs`:

- Stop using `ReadKey`'s null-on-`-9999` behavior to drop the row. The schedule and patients
  queries must keep `-9999` as a valid key so its appointment rows and `tblPatients` comment
  come through. (Splitting `ReadKey` into a version that keeps `-9999` for `ScheduleSql` /
  `PatientsSql`, and one that still excludes it for `PhonesSql` — no phone number should ever
  attach to the shared placeholder row — is one reasonable way to do this; a single helper with
  a `keepPlaceholder: bool` parameter is another.)
- When assembling the final `OpieScheduledPatient` for `OpiePatientId ==
  OpieOptions.PlaceholderPatientId`, force `LastName`, `FirstName`, `MiddleName`, `NickName`,
  `EmailAddress`, `PrimaryPractitioner`, `LanguagePref` to `null` and `PhoneNumbers` to empty —
  regardless of what those columns actually hold on the shared row. This is defense in depth:
  the placeholder is never a real identity and must never render a name or feed a phone number
  into the notify flow, no matter what staff have typed into that row in Opie over time.
  `Comment` passes through unchanged — that's the field carrying "LUNCH" / "MEETING" / etc.
- Do **not** touch `notifyOpiePatientSchema`'s refusal of `-9999`, or the notify endpoint's
  check — internal blocks must remain impossible to notify. The client won't offer a way to try
  (§3), but the server-side refusal is the real guarantee and stays.
- No server test project exists yet in this repo (`glob **/*.Tests*` finds nothing) — verify
  this change with `dotnet build apps/sona.server/sona.server.csproj` plus a manual check
  against a local Opie-shaped test db if one is available; say so explicitly in the report if it
  isn't and this was code-review-only.

### 2. Contract — no shape change, reuse the existing constant

`OPIE_PLACEHOLDER_PATIENT_ID` (`packages/shared/src/schemas.ts`) already exists — the client
imports it rather than hardcoding `"-9999"` anywhere (already true in `day-sheet.ts` today; keep
it that way). No change to `OpieScheduledPatient` / `OpieAppointment` in `packages/shared/src/types.ts`.

### 3. Client logic — `apps/sona.client/src/features/opie-schedule/day-sheet.ts`

- Remove the `continue` that currently skips placeholder patients in `buildDaySheet`.
- Add `isInternalBlock: boolean` to `DaySheetRow`, set from
  `patient.opiePatientId === OPIE_PLACEHOLDER_PATIENT_ID`. Components branch on this field, not
  on the raw id string, so the check lives in one place.
- `patientCount` stays a count of **real** patients — keep excluding the placeholder id from the
  `Set` it's built from.
- `appointmentCount` should keep meaning "patient appointments" for the toolbar summary — exclude
  internal-block rows from it. Add a new `internalBlockCount: number` to `DaySheet` (rows where
  `isInternalBlock`) so the UI can surface it separately (§4). Update the doc comment on
  `DaySheet.appointmentCount` to say it excludes internal blocks.
- `compareRows` / hour-bucketing need no change — internal-block rows have `startMinutes` like
  any timed row and sort correctly; a null `lastName` already sorts first via
  `(a.patient.lastName ?? '')`.

### 4. Client rendering

- `components/opie-day-sheet.tsx`, `AppointmentRow`: when `row.isInternalBlock`, render:
  - Row background highlighted (e.g. `bg-amber-50`) instead of the default, so it reads as
    "booked, but not a patient" at a glance.
  - Patient and Contact cells render `<Dash />` (component already exists in this file) instead
    of `<PatientCell>` / `<ContactCell>`.
  - Comment cell renders `patient.comment` exactly as it does for a normal row (same
    truncate/hover-title behavior) — that's where "LUNCH" etc. shows.
  - Actions cell renders nothing (`<Dash />` or empty) instead of `<NotifyOpieButton>` — internal
    blocks are never notifiable, so don't render a control that would need to explain why it's
    disabled.
  - Keep the row's `data-testid` on the same `opie-schedule-row-<opiePatientId>-<n>` pattern
    (`opiePatientId` is literally `"-9999"` for these) for consistency with every other row.
- `components/opie-schedule.tsx`: append the internal-block count to the summary line only when
  nonzero, e.g. `"Thu, Sep 3 · 5 appointments · 4 patients · 2 internal"` — decide exact wording,
  keep it short like the existing summary.

### 5. Tests (ship with the change per `AGENTS.md` §4 / Definition of Done)

- `day-sheet.test.ts`: replace the existing "...drops the -9999 staff placeholder" case with one
  asserting the placeholder row **is** kept, has `isInternalBlock: true`, carries the comment
  through, and is excluded from `patientCount` / `appointmentCount` but counted in
  `internalBlockCount`.
- A component test (new or added to an existing `opie-day-sheet`/`opie-schedule` test file, per
  the Vitest + Testing Library + MSW setup from Task 12) asserting: the internal-block row
  renders with the highlighted class / a distinguishing marker, shows the comment text, and does
  **not** render an `opie-notify-*` button.
- Exercise it in the running app (Local profile, per `AGENTS.md` §4/Task 13) if a local Opie-shaped
  db is reachable; otherwise say so and rely on the above tests + code review.

### 6. Docs (same commit, per `AGENTS.md` §4)

- `docs/opie-odbc-integration.md` — rewrite the "Placeholder rows" line (§ "Consumer" table);
  it currently says the repository drops the key and the row is "never listed or notified." New
  wording: still never *notified*, but now listed, redacted to comment-only, and visually
  distinguished.
- `docs/admin-ui-guide.md` — the day-sheet row description currently ends with "Opie's `-9999`
  staff placeholder is never listed." Replace with a description of the internal-block row
  (styling, which cells are blank, no notify control) and update the toolbar summary example if
  the internal count is appended there.

## Out of scope

- Distinguishing different kinds of internal blocks beyond their free-text comment (Opie has one
  shared placeholder patient row, so e.g. two different blocks booked the same day currently
  share one `fldPatientComment` value — an Opie-side limitation, not something to work around
  here).
- Any change to the notify endpoint's refusal of `-9999`, or to `notifyOpiePatientSchema`.
- Filtering/toggling internal blocks on or off in the UI (always shown, per the goal above).

## Definition of Done

Per `docs/tasks/_context.md` + `AGENTS.md` §4. In the report, call out explicitly: (a) that the
notify-refusal for `-9999` was left untouched and verified still in place, (b) whether the server
change was verified by `dotnet build` only or also against a real/local Opie-shaped db, and (c)
confirm no PHI was newly introduced — the placeholder's `comment` is an internal scheduling label,
not patient data, and was already the same field/UI cell used for real patients' clinical comments.
