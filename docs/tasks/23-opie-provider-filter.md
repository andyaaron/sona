# Task 23 — Opie day sheet: multi-provider filter

**Status: proposed 2026-09-04.**
**Depends on:** Task 22 Part B (appointment-level practitioner on `OpieAppointment`) for the
real behaviour; Task 21 (date-is-the-navigator toolbar) should ship first so the toolbar has a
settled shape to add to. See "Interim option" for what can ship before Task 22.

Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/admin-ui-guide.md` (Dashboard section, testid
rules) and `docs/opie-odbc-integration.md` §9 first. Reference implementation for the filter
pattern: `features/patients/patient-list-search.ts` (search state in URL search params).

## Ask (colleague feedback, 2026-09-04)

> Tab for different providers that filters the schedule. This would be on the Opie day schedule.
> So we probably want a dropdown of providers that are under the specific organization. Selecting
> the provider filters all schedules for patients under that provider. This will also require the
> patient being assigned to the provider. You can keep adding providers to the filter. There
> should also be a clear icon to remove all providers from filter.

## Target behaviour

- **Control:** a multi-select dropdown **Providers** in the day-sheet toolbar. Trigger button shows
  "All providers" when nothing is selected, otherwise "N providers" plus one removable chip per
  selected provider ("Last, First" + `×`). A **clear** icon button (lucide `X`, aria-label "Clear
  provider filter") appears only while at least one provider is selected and removes them all.
  Selections accumulate — picking a second provider adds to the filter, it does not replace.
- **Placement (left → right, after Task 21):** `[view switcher — Task 29]` · `[‹ date ›` + counts]
  · **Providers filter** · `[Today] [date input]` (jump group stays `ml-auto`). On a narrow viewport
  the filter wraps with the jump group, never inside the navigator group.
- **Options:** the organization's active Sona providers (`GET /api/providers`, already org-scoped)
  that have an Opie practitioner mapping (see "Data model"), ordered by last name. Providers with
  no mapping are listed but disabled with title "Not linked to an Opie practitioner" so admins
  can see the gap. `system_admin` viewing the bound org sees that org's providers.
- **Filtering (client-side, no schedule API change beyond Task 22):** a patient row is shown when
  its appointment's `practitionerId` equals any selected provider's `opiePractitionerId`. Apply
  the filter to the patient list **before** `buildDaySheet`, so hour bounds and the count line
  reflect the filtered day. Internal blocks (`-9999`): shown only if their row's practitioner
  matches, or always if Opie blocks carry no practitioner — decide from Task 22 findings and say
  which in the guide.
- **Counts:** `opie-schedule-summary` shows filtered counts; when a filter is active append a quiet
  "of N" for appointments (e.g. "**4** of 12 appts") so staff can tell the filter is on even
  when the chips scroll out of view.
- **Empty result:** `opie-schedule-empty-filtered` "No appointments for the selected providers."
  with an inline "Clear filter" link — distinct from `opie-schedule-empty` (nobody booked).
- **Persistence:** selection lives in the route's search params, `?providers=<id>,<id>` (Sona
  `Provider` GUIDs), validated by zod next to `?date=`. Stepping the date keeps the filter (the
  stepper must preserve other search params). Refresh/share keeps it. No localStorage.
- **Keyboard/a11y:** trigger is a real `<button aria-haspopup="listbox" aria-expanded>`; options are
  checkboxes; `Escape` closes; chips' `×` are buttons with aria-label "Remove {name}".

## Data model — linking Sona providers to Opie practitioners

Sona `Providers` (org-scoped, `Data/DbModels/Providers/Provider.cs`) and Opie practitioners are
two identity spaces, same situation as `Patients.Id` vs `fldPatientID` (decision 2026-09-03: keep
them separate, add a nullable mapping column). Add:

- `Provider.OpiePractitionerId` (`string?`, MaxLength 50, unique per organization when not null),
  migration `ProviderOpiePractitionerId`, `docs/data-model.md` row.
- Contract: `Provider` type + `createProviderSchema`/`updateProviderSchema` gain optional
  `opiePractitionerId`; `ProvidersController` maps it; `/providers/manage` form gets a field
  "Opie practitioner ID" (`provider-form-opie-practitioner-id`, org_admin+) — guide updated.
- **Patient ↔ provider assignment** in the ask is satisfied by Opie's own data (the appointment's
  practitioner), not by `Patient.PrimaryProviderId` — Opie rows have no Sona `Patient`. Say this
  explicitly in the guide so nobody expects the Sona patient's primary provider to drive it.

## Interim option (if Task 22 is far off)

Ship the same UI keyed on `OpieScheduledPatient.primaryPractitioner` (already returned, a raw
string) with options derived from the distinct values on the loaded day, and label the trigger
"Primary practitioner" — *not* "Providers" — because it is the patient's primary practitioner,
not who the appointment is with (§9.1 warns exactly this). Behind a one-line constant so the swap
to `appointment.practitionerId` is trivial. Only do this if the answer to Q23.1 is "yes".

## Testids

`opie-schedule-provider-filter` (wrapper) · `-trigger` · `-listbox` · `-option-<providerId>` ·
`-chip-<providerId>` · `-chip-<providerId>-remove` · `-clear` · `opie-schedule-empty-filtered` ·
`opie-schedule-count-appointments-total` (the "of N" span). Register all in the guide.

## Tests (same task)

- `day-sheet.test.ts`: filtering helper (`filterByPractitioners(patients, ids)`) — matches,
  no-match, empty selection = all, placeholder handling.
- `routes/index.test.tsx`: `?providers=` pre-selects chips; selecting adds a chip and hides
  non-matching rows; clear restores; stepping the date keeps `?providers=`.
- Component test for the multi-select if it lands in `src/components/`.
- `e2e/opie-schedule.spec.ts` (`@smoke`): pick one provider → only its rows visible → clear.
  Skips like the rest of the file when Opie is unconfigured.

## Docs (same commit)

`docs/admin-ui-guide.md` Dashboard toolbar + interactions + testids; `/providers/manage` form
field; `docs/opie-odbc-integration.md` §8 (contract) and §9.2; `docs/data-model.md` (Provider
column). Verify in the running app (Local profile) and quote what was observed.

## Non-goals

- No per-provider swimlanes or columns (Task 24 / 29).
- No server-side filtering — the day is small; keep the single day query.
- No automatic matching of Sona providers to Opie practitioners by name.

## Open questions (answer by number)

- **Q23.1** Ship the interim "Primary practitioner" filter now (on the patient's primary
  practitioner), or wait for Task 22 and filter by the appointment's actual practitioner?
  Recommendation: wait — a filter that silently shows the wrong provider's patients is worse
  than none.
- **Q23.2** Options source: Sona `Providers` linked to Opie ids by hand (proposed), or simply the
  distinct practitioners Opie returns for the day (no Sona data, no admin work, but no "providers
  under the organization" list independent of the day)?
- **Q23.3** Should the filter also apply to internal blocks, or always show them?
- **Q23.4** Should the filter persist per user across sessions (localStorage) in addition to the
  URL? Proposed: URL only.
- **Q23.5** "Tab" in the ask — do you picture actual tabs (one per provider, single-select) or the
  multi-select dropdown described here? The multi-select with chips is assumed because of "keep
  adding providers".
