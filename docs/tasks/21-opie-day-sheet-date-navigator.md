# Task 21 — Opie day sheet: make the date the navigator (arrows flank the date)

**Status: proposed 2026-09-03 — optional.** Do this when the day-sheet toolbar is about to grow
(practitioner filter, waiting-room queue, notification history…). Until then the shipped layout
("option A", shipped 2026-09-03) is fine: date heading on the left, count chips
beside it, stepper + date input pushed right.

Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/admin-ui-guide.md` (Dashboard section) and
`docs/opie-odbc-integration.md` § client first.

## Why

Today the thing you change (the `‹` / `›` stepper, on the right) and the thing you are looking at
(the date heading, on the left) sit at opposite ends of the toolbar, so every click makes the eye
bounce across the row. Calendar apps put the arrows on the date itself. As more controls land in
the toolbar the two ends drift further apart and the stepper stops reading as "change the date"
and starts reading as "one more button".

## Target layout (left → right)

```
[‹]  Wednesday, Sep 3                       [Today] [ 2026-09-03 ▾]
     12 appts · 10 patients · 2 internal
```

- **Navigator group** (left): `‹` (`opie-schedule-prev-day`, aria-label "Previous day", square
  `h-8 w-8` secondary button) · **date block** · `›` (`opie-schedule-next-day`, aria-label
  "Next day"). The date block is a fixed-min-width centred stack (`min-w-[13rem] text-center` or
  similar) so the arrows do not shift when the weekday length changes:
  - line 1 `opie-schedule-heading`: the date, `text-lg font-semibold tabular-nums`, e.g.
    "Wednesday, Sep 3" (same `formatDateHeading` as today — keep `weekday: 'long'`).
  - line 2 `opie-schedule-summary`: counts as one quiet `text-xs text-gray-500` line, numbers
    bold (`font-semibold text-gray-800`), internal number in `text-amber-900`: "**12** appts ·
    **10** patients · **2** internal". Keep the per-count testids
    (`opie-schedule-count-appointments` / `-patients` / `-internal`) on the `<span>`s so the
    existing unit tests and e2e assertions keep working; the internal span still only renders
    when `internalBlockCount > 0`. Decide "appts" vs "appointments" by width — it must not wrap
    at the narrowest layout the toolbar supports.
- **Jump group** (right, `ml-auto`): **Today** (`opie-schedule-today`, secondary, disabled
  while the shown date is today) · native date input (`opie-schedule-date`). The sky **Today
  badge** (`opie-schedule-today-badge`) from option A is dropped — the disabled Today button
  already says it, and the badge would fight the heading in the centred stack.
- Wrapping: on a narrow viewport the jump group wraps under the navigator group, right-aligned.
  Nothing in the navigator group may wrap internally (the stack must stay `‹ date ›`).

## Requirements

1. `apps/sona.client/src/features/opie-schedule/components/opie-schedule.tsx` only — no contract,
   API or `day-sheet.ts` change. Keep `formatDateHeading` and the `CountChip`-style helper (rename
   if it is no longer a chip). No new dependencies; `lucide-react` chevrons as today.
2. Keyboard: `←` / `→` while focus is inside `opie-schedule-toolbar` (not inside the date input)
   step the day. Optional but cheap; if implemented, document it in the guide and add a unit test.
3. All existing testids listed above survive. The only removal is `opie-schedule-today-badge`.
4. Tests (same task, per AGENTS.md §4):
   - `apps/sona.client/src/routes/index.test.tsx`: the "renders the date…" and "shows the empty
     state…" cases assert heading text + per-count spans; the stepper/Today case is unchanged.
     Remove the `opie-schedule-today-badge` assertion. Add: the navigator group contains the
     heading between the two arrow buttons (DOM order `prev-day` → `heading` → `next-day`).
   - `apps/sona.client/e2e/opie-schedule.spec.ts`: `opie-schedule-summary` `toContainText`
     assertions still hold; no change expected unless the "appts" abbreviation is chosen — then
     the `${blocks.length} internal` assertion still passes, but re-run to confirm.
5. Docs in the same commit:
   - `docs/admin-ui-guide.md` Dashboard → Toolbar bullet: rewrite left → right order, drop the
     badge, add the keyboard shortcut if shipped. Remove the "Follow-up: `docs/tasks/21-…`"
     pointer.
   - `docs/opie-odbc-integration.md` § client: one-line toolbar description.
   - This file: set status to done with the date, add audit notes for any deviation.
6. Verify in the running app (Local profile, Task 13): step with `‹` / `›`, confirm the arrows
   do not move as the weekday changes (Mon → Wednesday), confirm Today disables on today, resize
   to ~640px and confirm the jump group wraps under the navigator without the stack breaking.
   Quote what was observed in the report.

## Non-goals

- No practitioner filter, no queue, no history — those are their own tasks; this one only
  makes room for them.
- No change to the sheet table, hour buckets, now marker or internal block rows.
- No date-range / week view.

## Reference

Mockup "D. Date is the navigator" in the 2026-09-03 comparison (Claude artifact
`day-sheet-header-options`); options A–D and the recommendation are summarised in the guide's
git history for the commit that shipped option A.
