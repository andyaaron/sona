# Task 27 — Check-in flow: per-appointment visit state on the Opie day sheet

**Status: proposed 2026-09-04.** Expands Task 26 (notified state) into the full front-desk →
nurse → physician → check-out flow described by Jamie.
**Depends on:** Task 22 Part B (stable `scheduleId` — a state must attach to one appointment,
not to a patient-per-day), Task 26 (row state rendering pattern; may be folded in), and the
answer to Q27.1 (whether Opie already tracks any of these states — if it does, Sona must read
them, not duplicate them).

Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/data-model.md` (EntityBase conventions,
Encounter enhancement), `docs/admin-ui-guide.md` (Dashboard) and Task 26 first.

## Ask (Jamie, via colleague feedback 2026-09-04)

After the text is sent there is a flow for the patient's visit state:

| # | State | Meaning (verbatim from the ask) |
|---|---|---|
| 1 | **Confirmed** | Not in building yet / patient is scheduled |
| 2 | **Arrived** | Just walked in and told the front desk their Dr and appointment time |
| 3 | **Checked in** | In the front waiting room; initial paperwork provided by the front desk, being filled out by the patient |
| 4 | **Ready** | Initial paperwork done; ready to be brought back by nurse/MA/LPN |
| 5 | **Seen by LPN/MA** | Nurse took the patient from the waiting room; weighed, BP checked, now in an exam room waiting for the doc |
| 6 | **Seen by Physician** | Seen by the doc, diagnosis/prescriptions done; ready for the nurse to walk them out to schedule the next visit |
| 7 | **Check out** | Walked out to the front waiting room to talk to the front desk and depart |

## Design

### Data (Sona-owned; Opie stays read-only)

New table **`AppointmentVisits`** (`EntityBase`: Guid v7 PK, CreateDate/ModDate):

| Column | Type | Notes |
|---|---|---|
| `OrganizationId` | Guid FK | tenant; always the Opie-bound org today |
| `OpieScheduleId` | string(50) | the appointment (Task 22); unique with `OrganizationId` |
| `OpiePatientId` | string(50) | denormalised for the per-patient history query |
| `ScheduleDate` | date | the sheet date; index `(OrganizationId, ScheduleDate)` — the day query |
| `Status` | string | one of the union below |
| `StatusChangedByUserId` | int FK AppUser | who moved it last |
| `StatusChangedDateTime` | datetime (UTC) | |
| `ExamRoom` | string?, MaxLength 50 | optional, entered at step 5 if Opie has no room (Task 24 Q24.4) |

New table **`AppointmentVisitEvents`** (append-only audit — who moved what, when; the visit row is
the current state, the events are the history): `VisitId` FK, `FromStatus`, `ToStatus`,
`ChangedByUserId`, `ChangedDateTime`. No free-text note column (PHI leak risk; add later only
with compliance review).

No PHI beyond ids and times is stored; nothing is logged but counts/ids.

### Contract (`packages/shared`)

```ts
export type VisitStatus =
  | 'scheduled'        // 1 Confirmed — the implicit state when no visit row exists
  | 'arrived'          // 2
  | 'checked_in'       // 3
  | 'ready'            // 4
  | 'with_nurse'       // 5 Seen by LPN/MA
  | 'with_physician'   // 6 Seen by Physician
  | 'checked_out'      // 7
```

`VISIT_STATUS_ORDER` (the linear sequence) and `VISIT_STATUS_LABELS` (the display names from the
table above — "Seen by LPN/MA", "Seen by Physician", "Check out") live next to the type so client
and tests share one source. `updateVisitStatusSchema = { scheduleId, status, examRoom? }`.
`OpieAppointment.visit: { status, changedDateTime, changedBy: { id, displayName } } | null`.
Endpoints (`packages/api-client` `opieApi`): `PUT /api/opie/appointments/{scheduleId}/visit`
(upsert; 201/200 with the visit), `GET /api/opie/appointments/{scheduleId}/visit/events`
(history — optional, Q27.6).

### Transitions

- Forward one step is the primary action. Skipping forward (e.g. Arrived → Ready when there is no
  paperwork) is allowed via the dropdown — Q27.3. Moving **back** one step is allowed (mistakes
  happen) and audited like any change. `checked_out` is terminal for the button but still
  editable via the dropdown.
- Where the SMS fits: "Ready to be seen" is sent by staff when the patient should come in from
  outside; in this vocabulary that is a *notification*, not a state. Proposed: sending the SMS
  does not change the visit state; the NOTIFIED badge (Task 26) stays separate from the Status
  column. Q27.2 decides.
- Rows without a visit row are `scheduled` (implicit; no insert until the first change).
- Roles: any `AssignedUser` of the bound org can change status (front desk and clinical staff
  both do); `system_admin` too. No finer role split until asked — Q27.4.

### UI (day sheet)

- New **Status** column after Room (Task 24) / after Patient (if 24 has not shipped):
  a status pill (`opie-visit-status-<key>`, text = label, colour per state — see below, never
  colour alone) with a **Next: {next label}** button (`opie-visit-next-<key>`, secondary, sm)
  and a caret opening the full list (`opie-visit-menu-<key>`, `opie-visit-option-<key>-<status>`),
  including one step back. Change → `PUT` → optimistic cache update → toast on error only.
- **Row tint by state** (background only, text colours unchanged): scheduled = none · arrived =
  `bg-sky-50` · checked_in = `bg-indigo-50` · ready = `bg-emerald-50` · with_nurse =
  `bg-violet-50` · with_physician = `bg-purple-50` · checked_out = `bg-gray-50` + muted text.
  The Task 26 notified tint is replaced by the state tint once this ships; the NOTIFIED badge
  remains. Internal blocks unchanged (amber).
- **Counts:** `opie-schedule-summary` gains a compact state strip on today only:
  "3 waiting · 2 in rooms · 4 done" (`opie-schedule-count-waiting` = arrived+checked_in+ready,
  `-in-rooms` = with_nurse+with_physician, `-done` = checked_out). Chips filter like the internal
  chip (toggle show only that group).
- **Multi-device:** the 30 s refetch from Task 26; conflicting edits are last-write-wins (the
  server returns the stored row; the client replaces its cache — no version check unless Q27.5
  says otherwise).
- **End of day:** nothing resets; state is per appointment per date, so tomorrow's sheet starts
  clean.

### Tests (same task)

- Server: transition validation (unknown status 400, cross-org 404, placeholder `-9999` 400),
  event row written on every change, upsert idempotent.
- `day-sheet.test.ts`: group counts; filters. `opie-day-sheet.test.tsx`: pill/tint per state,
  Next button label, menu contents (one back, all forward), terminal state.
- `routes/index.test.tsx`: click Next → PUT → row updates without refetch.
- e2e (`@smoke`, skips without Opie): scheduled → Next ×3 → reload → state persisted → back one.

### Docs (same commit)

Guide (column, pills, buttons, chips, colours, interactions, role gate, testids);
`docs/data-model.md` (two tables + ERD); `docs/opie-odbc-integration.md` §8 (contract);
`docs/compliance.md` audit paragraph (visit events are an audit trail, no free text); migration
`AppointmentVisits`. Verify in the running app and quote what was observed.

## Non-goals

- No writing to Opie or Cerner.
- No timers / wait-time analytics (natural follow-up once events exist — note in `_backlog.md`).
- No patient-facing status (mobile app) yet.

## Open questions (answer by number)

- **Q27.1 (blocking)** Does Opie (or Cerner, if staff use both) already record arrived / checked
  in / roomed for these appointments? If yes, Sona should display that and only add what is
  missing — Task 22 item 4 records what exists.
- **Q27.2** Where does the "ready to be seen" SMS sit in the flow? Options: (a) independent
  notification, no state change (proposed); (b) sending it moves the row to **Confirmed**; (c)
  it is what moves the patient to **Ready**. The ask's "change notify button to say 'checked in'
  or 'confirmed'" suggests (b) but the state definitions do not mention the text.
- **Q27.3** May steps be skipped (Arrived → Ready for returning patients with no paperwork) and
  may staff move back? Proposed: both allowed, all audited.
- **Q27.4** Who may change which states — everyone in the org (proposed), or front desk only for
  1–4 and clinical staff for 5–7? Sona has no clinical/front-desk role today (roles are
  system_admin / org_admin / assigned / unassigned), so a split would need new roles.
- **Q27.5** Two machines editing the same row: last write wins (proposed) or reject with a
  "changed by X, refresh" conflict?
- **Q27.6** Is a per-row history ("Arrived 9:02 by Jamie, Checked in 9:05 by …") wanted in v1,
  or is the audit table enough for now?
- **Q27.7** Are no-show and cancelled states needed alongside the seven? (Cancelled may come from
  Opie — Task 22.)
- **Q27.8** Label check: keep Jamie's names verbatim ("Seen by LPN/MA", "Seen by Physician",
  "Check out") or shorter ("With nurse", "With provider", "Checked out")? Proposed: verbatim in v1
  since that is the clinic's vocabulary; the provider is not always a physician at an O&P clinic
  — confirm "Physician" is right.
