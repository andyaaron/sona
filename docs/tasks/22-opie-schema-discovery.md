# Task 22 — Opie schema discovery: appointment practitioner, exam room, appointment identity

**Status: proposed 2026-09-04 — UNBLOCKER for Tasks 23, 24, 25, 26, 27 and 29.**
**Blocked on:** access to the real `Opie_data` schema. Only the fake Docker `Opie_data` (3 patients,
§2 columns only) exists on this machine; real credentials and schema live on the work repo
(docs/opie-odbc-integration.md §8 "Verification checklist for the first real run"). The SQL below
can be prepared and dry-run against the fake DB, but the findings need a real connection.

Read `docs/tasks/_context.md`, `AGENTS.md`, and `docs/opie-odbc-integration.md` (§2, §3, §9.1,
§9.3) first.

## Why

Colleague feedback from running the app (2026-09-04) asks for four things that all need facts we
do not have about Opie's schema:

| Ask | Task | Missing fact |
|---|---|---|
| Filter the day sheet by provider | 23 | Which column says who *an appointment* is with (not the patient's primary practitioner) |
| Provider + exam room columns (mirror Cerner's Ambulatory Organizer) | 24 | Practitioner column, exam-room/resource column, and how those ids resolve to display names |
| Appointment time + provider name in the SMS | 25 | Confirm `fldPatientScheduleStartTime` is the patient-facing appointment time; practitioner name resolution |
| Notified / check-in state per appointment | 26, 27 | A stable per-appointment identity (today the row key is `<opiePatientId>-<index>`, which is only stable while Opie returns rows in the same order) |

Colleague note on the Cerner ask, verbatim: "we already have a db column from this db, will need
to investigate to get you the correct column name. and its just an ID, i haven't found how the ID
relates to actual provider/practitioner data". §9.1 already predicted this: Opie's real
`tblPatientSchedule` very likely has practitioner / resource / status / type / location columns that
the §2 column list never pulled.

## Deliverable

**Part A — findings (no product code).** A new §10 "Schema findings (YYYY-MM-DD)" in
`docs/opie-odbc-integration.md` answering every question in "What to find" below, with the exact
column names, SQL types, nullability, and the lookup-table join for each id. Column names and types
only — never paste patient rows into the doc (§3). Practitioner *names* are staff data, not patient
PHI, and may be listed if useful.

**Part B — foundation columns (same task, once Part A is confirmed).** Extend the read path so the
consuming tasks only do UI work:

1. `OpieScheduleRepository.ScheduleSql` selects the confirmed columns; `OpieAppointment` (server
   record) gains, named after what is actually found: `ScheduleId` (the row's PK, as a trimmed
   string like `fldPatientID`), `PractitionerId`, `PractitionerName` (resolved server-side via the
   lookup table found in Part A — one extra query, assembled in code like the phone/patient
   queries; never a fan-out join), `ExamRoom` (id + display name if the room is a lookup),
   `Status` (raw Opie value, if a status/cancelled column exists), `AppointmentType` (if exists).
2. Contract (`packages/shared/src/types.ts` `OpieAppointment`) + `packages/api-client` (no
   endpoint change) + `apps/sona.client/src/testing/fixtures` and MSW handlers updated together
   (AGENTS.md rule 2). All new fields nullable — the fake DB and any Opie without the column must
   still work.
3. `day-sheet.ts`: `DaySheetRow.key` becomes `scheduleId` when present, falling back to
   `<opiePatientId>-<index>`. Update the testid derivation note in `docs/admin-ui-guide.md`
   (`opie-schedule-row-<key>`, `opie-notify-<key>`) — the e2e spec derives ids from the API
   response, so it should keep passing; confirm.
4. If a cancelled/status column exists: filter cancelled rows server-side (§9.3) and say so in
   the guide. Do **not** render practitioner/room yet — that is Task 24.

## What to find (run against the real Opie_data)

```sql
-- 1. Full column inventory of the two tables we read
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('tblPatientSchedule', 'tblPatients')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 2. Candidate lookup tables for practitioners / rooms
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%Practitioner%' OR TABLE_NAME LIKE '%Provider%' OR TABLE_NAME LIKE '%Physician%'
   OR TABLE_NAME LIKE '%Staff%' OR TABLE_NAME LIKE '%Employee%' OR TABLE_NAME LIKE '%User%'
   OR TABLE_NAME LIKE '%Resource%' OR TABLE_NAME LIKE '%Room%' OR TABLE_NAME LIKE '%Location%'
   OR TABLE_NAME LIKE '%Facility%' OR TABLE_NAME LIKE '%Schedule%';

-- 3. Declared foreign keys (Opie may declare none — then fall back to value profiling)
SELECT fk.name, tp.name AS parent_table, cp.name AS parent_col, tr.name AS ref_table, cr.name AS ref_col
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables tp ON tp.object_id = fkc.parent_object_id
JOIN sys.columns cp ON cp.object_id = tp.object_id AND cp.column_id = fkc.parent_column_id
JOIN sys.tables tr ON tr.object_id = fkc.referenced_object_id
JOIN sys.columns cr ON cr.object_id = tr.object_id AND cr.column_id = fkc.referenced_column_id
WHERE tp.name IN ('tblPatientSchedule', 'tblPatients');

-- 4. Primary key of tblPatientSchedule
SELECT kcu.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
WHERE tc.TABLE_NAME = 'tblPatientSchedule' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY';

-- 5. Value profile of a candidate id column (repeat per candidate) — counts only, no names
SELECT <candidateColumn>, COUNT(*) FROM dbo.tblPatientSchedule GROUP BY <candidateColumn> ORDER BY 2 DESC;
```

Answer, in the doc:

1. **Appointment practitioner:** column on `tblPatientSchedule` naming who the appointment is
   with; its type; the lookup table + name columns it resolves to; how it relates (if at all) to
   `tblPatients.fldPatientPrimaryPractitioner`. Is `fldPatientPrimaryPractitioner` an id or a name?
2. **Exam room / resource:** column; lookup table; whether it is a room, a chair, or a generic
   "resource"; whether a booking can have several.
3. **Row identity:** PK of `tblPatientSchedule`; whether it is stable (identity vs. regenerated).
4. **Status:** cancelled / no-show / confirmed / arrived columns or flags and their value domain.
   If Opie already tracks arrival/check-in, Task 27 must decide whether to read it instead of
   duplicating it in Sona — record what exists.
5. **Appointment time:** confirm `fldPatientScheduleStartTime` is the time the patient is told
   (vs. slot/arrival time), its SQL type, and that values are local wall-clock with no offset
   (the client assumes so — `day-sheet.ts` `toMinutesOfDay`).
6. **Types:** `fldPatientID` (int vs char), and whether `-9999` is the only placeholder id.
7. **Anything else useful:** appointment type/reason (PHI — note it, do not plan to show it),
   location/site column (a second clinic would matter for Task 23's "providers under the
   organization").

## Definition of Done

- Part A: §10 written; this file's status set to done with the date; open questions below
  answered inline.
- Part B: `dotnet build Sona.slnx`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass. Do **not**
  make the SQL conditional on column presence; instead add the confirmed columns to the fake
  Docker `Opie_data` (`ALTER TABLE dbo.tblPatientSchedule ADD …`, documented in
  `docs/getting-started.md` next to the fake-DB setup) so Local matches the real shape and the
  sheet still renders there.
- Guide + `docs/opie-odbc-integration.md` §8 table updated for the new row key.
- Report: what was verified against the real Opie vs the fake DB.

## Open questions (answer by number)

- **Q22.1** The Cerner note says "we already have a db column from *this* db". Which database:
  `Opie_data`, or a separate Cerner extract? If Cerner, is there a connection/export to look at?
- **Q22.2** Do you already know any of the column names (practitioner id, room), even partially?
  Paste whatever you have — it shortcuts the profiling.
- **Q22.3** Can a read-only Opie login be issued to run the discovery SQL from this machine, or
  should the queries be run on the work machine with results pasted back (column names only)?
- **Q22.4** Does the clinic have more than one site/location in Opie? (Affects whether "providers
  under the organization" needs a location filter as well.)
