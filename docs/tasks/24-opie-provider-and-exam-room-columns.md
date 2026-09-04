# Task 24 — Opie day sheet: Provider and Exam Room columns (mirror Cerner's Ambulatory Organizer)

**Status: proposed 2026-09-04.**
**Depends on:** Task 22 Part B (practitioner + room on `OpieAppointment`, names resolved
server-side). Nothing here can be built correctly before that — the ask itself says the ids do
not yet resolve to provider data.

Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/admin-ui-guide.md` (Dashboard → Day sheet) and
`docs/opie-odbc-integration.md` §9 first.

## Ask (colleague feedback, 2026-09-04)

> Mirror Ambulatory Organizer in Cerner: column for provider and column for exam room. We already
> have a db column from this db, will need to investigate to get you the correct column name. And
> it's just an ID, I haven't found how the ID relates to actual provider/practitioner data, so
> this will need more investigation to complete.

Cerner's Ambulatory Organizer "Day View" is a table per provider/resource with columns roughly:
Time · Duration · Patient · Details · Status · Location (room). The two columns asked for here are
**Provider** and **Room**. Whether the full per-provider layout is wanted is Q24.1.

## Target behaviour

- **Day sheet columns (left → right):** Time · Patient · **Provider** · **Room** · Contact ·
  Comment · (actions). Provider and Room sit right after Patient because they are what staff scan
  for after "who/when"; Contact and Comment are secondary.
  - **Provider cell:** the appointment's practitioner display name from `OpieAppointment.
    practitionerName` (Task 22). Fallback when Opie gives an id but no name resolved: the raw id
    in `font-mono text-xs text-gray-500` with title "Unresolved Opie practitioner id" — never
    blank, so the gap is visible. "—" when no practitioner. If a Sona `Provider` is linked
    (`Provider.OpiePractitionerId`, Task 23), prefer the Sona display name + credentials
    ("Smith, Jane CPO") so the sheet matches `/providers/manage`.
  - **Room cell:** `OpieAppointment.examRoom` display name; "—" when none.
  - Internal block rows: keep the merged label cell but let it span the new columns
    (`colSpan` grows from 3 to 5); if Task 22 finds blocks carry a practitioner/room, show them
    in their own cells instead of merging.
  - Header order in `opie-day-sheet.tsx` `<thead>`; `NowMarker`/hour header `colSpan` updated to 7.
- **Sorting within an hour:** unchanged (start time, then last name). Provider grouping is not
  this task (Q24.1).
- **Width:** at ~1024px the sheet must still fit without horizontal scroll for typical values;
  Contact already wraps per phone line — put Provider/Room in `whitespace-nowrap` cells and let
  Comment keep `max-w-xs`.

## Contract / API

No endpoint change: the fields arrive on `GET /api/opie/schedule` from Task 22. If Task 22 shipped
ids only (no name resolution), this task adds the resolution: one extra query against the lookup
table found in Task 22, assembled in code (never a fan-out join), names cached per request only.

## Testids

None new for cells (rows are selected by `opie-schedule-row-<key>`; assert cell text by column
header order in tests). Register header text changes in the guide's Day sheet bullet.

## Tests (same task)

- `opie-day-sheet.test.tsx`: renders provider name and room per row; unresolved id fallback;
  internal block colSpan spans the new columns; "—" for nulls.
- `routes/index.test.tsx`: fixtures gain `practitionerName`/`examRoom`; header order asserted.
- e2e: `opie-schedule.spec.ts` asserts the header text contains Provider and Room (no data
  assumption — the fake DB may have nulls).

## Docs (same commit)

`docs/admin-ui-guide.md` Day sheet header + row description (remove "(No practitioner column…)"
parenthetical — it is no longer true); `docs/opie-odbc-integration.md` §9.2/§9.3 (strike the
"if it carries a practitioner" follow-up). Verify in the running app and quote what was observed.

## Non-goals

- No per-provider swimlanes / grid (Task 29 "Day" view may become that — see Q24.1).
- No Cerner connection — "Cerner" here is the layout being mirrored, not a data source.
- No editing of provider/room (Opie is read-only).

## Open questions (answer by number)

- **Q24.1** "Mirror" = just add the two columns to the existing hourly list (assumed here), or
  reproduce the organizer's per-provider layout (one column/lane per provider with the room in
  each cell)? If the latter, fold it into Task 29's "Day" view rather than this task.
- **Q24.2** Can you share a screenshot of the Cerner Ambulatory Organizer view being mirrored
  (with any patient data covered)? Column order and what "Status" shows there matter for Task 27.
- **Q24.3** Provider display: Opie's practitioner name as stored, or the linked Sona `Provider`
  ("Last, First Credentials")? Proposed: Sona when linked, Opie name otherwise.
- **Q24.4** Is the exam room assigned at booking time in Opie, or only when the patient is roomed?
  If the latter it is empty on most rows at the start of the day and Task 27 may need Sona-side
  room entry.
