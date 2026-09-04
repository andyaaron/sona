# Task 29 — Opie schedule: view switcher (Hourly list · Day · Week)

**Status: proposed 2026-09-04.** Q29.1 (what "Day" shows) must be answered before starting —
the two readings are very different amounts of work.
**Depends on:** Task 21 (toolbar with the date as the navigator — the switcher goes left of it).
Week view needs a small API change (below). Task 23's provider filter and Task 27's state
column should apply in every view.

Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/admin-ui-guide.md` (Dashboard → Toolbar),
Task 21 and `docs/opie-odbc-integration.md` §9 first.

## Ask (colleague feedback, 2026-09-04)

> Add different views, currently we have hourly list. Add day and week buttons. Hourly list will
> be default. This would be inserted to the left of the Date, and appt/patient/internal count.

## Target behaviour

- **Switcher:** a segmented control (`opie-schedule-view`, `role="radiogroup"`) with three
  buttons **Hourly** (`opie-schedule-view-hourly`) · **Day** (`opie-schedule-view-day`) ·
  **Week** (`opie-schedule-view-week`), placed as the first item of the toolbar, left of the
  `‹ date ›` navigator (Task 21). Hourly is the default. Selection is in the URL:
  `?view=hourly|day|week` (zod, default `hourly`), preserved by the date stepper.
- **Hourly** (existing): unchanged.
- **Day** — see Q29.1. Proposed reading: a **time grid** — one column per provider (from Task 22/24
  practitioner data; a single "All" column when none), rows every 15 minutes from the first start
  to the last end, appointments as blocks spanning their duration (patient name + room), internal
  blocks amber, the now line across the grid on today. This is the Cerner organizer shape and
  gives Task 24's "mirror" its home. Notify/state controls on hover/click of a block (popover
  reusing the row's `NotifyOpieButton` / status control). Testids: `opie-schedule-grid`,
  `opie-schedule-grid-column-<practitionerId|all>`, `opie-schedule-grid-block-<key>`.
- **Week** — seven columns Mon–Sun (Q29.3) containing the week that includes the shown date;
  each column: day header with date + count line ("8 appts · 1 internal"), then a compact list of
  appointments (time · Last, First · provider) in time order. Clicking a day header switches to
  Hourly for that date (`?view=hourly&date=…`). Today's column highlighted. No notify/state
  controls in week view (Q29.4). Testids: `opie-schedule-week`, `opie-schedule-week-day-<date>`,
  `opie-schedule-week-row-<key>`. Date stepper in week view steps by 7 days; the heading reads
  "Sep 1 – Sep 7".
- **Counts line:** stays next to the date and reflects the shown range (day, or week totals).
- **Provider filter (Task 23)** applies in all three views; **visit state (Task 27)** tints
  blocks/rows in Day and Week the same way as Hourly.

## API

`GET /api/opie/schedule?date=` gains an optional `to=YYYY-MM-DD` (inclusive, max 7 days, `400`
beyond); the repository's three queries change their predicate to `CAST(start AS DATE) BETWEEN
@from AND @to`. Response shape unchanged (patients with their appointments across the range —
appointments already carry full datetimes, so the client buckets by date). Contract:
`opieScheduleQuerySchema.to`, `opieApi.schedule` passes it through; new query key includes the
range so day and week caches do not collide. §9.3 considered seven queries — one range query is
one Opie round trip instead of seven and is preferred. Logging stays counts + dates.

## Tests (same task)

`day-sheet.ts` gains `buildWeek(patients, from)` and `buildDayGrid(patients, nowMinutes)` with
unit tests (bucketing across midnight-free days, empty days, block spans, overlapping
appointments in one provider column → side-by-side or stacked; say which). `routes/index.test.tsx`:
`?view=` selects the view, switcher updates the URL, week stepper moves 7 days, header click jumps
to hourly. e2e: switch to Week → seven day columns → click a header → Hourly of that date.
Server: `to` validation.

## Docs (same commit)

Guide toolbar bullet (switcher first), new "Day view" and "Week view" sub-bullets with testids and
interactions; `docs/opie-odbc-integration.md` §8 endpoint row + §9. Verify in the running app at
~1280px and ~768px (week must scroll horizontally inside its container, never the page).

## Non-goals

- No month view, no drag-to-reschedule (Opie is read-only).
- No printing layout.

## Open questions (answer by number)

- **Q29.1 (blocking)** What should **Day** show that Hourly does not? (a) The per-provider time
  grid described above (Cerner-organizer style; larger task, subsumes Task 24 Q24.1); (b) a
  flat, ungrouped list of the day without hour headers (small task); (c) something else — a
  sketch would settle it.
- **Q29.2** Should Week show appointment rows (proposed) or only per-day counts (the "week strip"
  from §9.3) that link into the day?
- **Q29.3** Week starts Monday (proposed) or Sunday? Is the clinic open weekends (hide Sat/Sun
  when empty)?
- **Q29.4** Are notify / status controls needed inside Week view, or is it a read-only overview?
- **Q29.5** Is one Opie query per week (up to 7 days of rows) acceptable, or should Week stay at
  counts only to limit load?
