# Task 06 — Patient list pagination + sortable columns (server-driven)

**Prerequisite:** Task 00 merged. Combines the two "Lower Priority" items in `docs/patient-tasks.md` (pagination + sortable columns) — they touch the same endpoint, contract, and UI; doing them separately churns the same code twice.
Read `docs/tasks/_context.md` and `AGENTS.md` first.

## Goal

`GET /api/patients` becomes paged and sortable; the patients page gets page controls and clickable column headers.

## Requirements

1. **Contract first** (`packages/shared/src/types.ts`):
   ```ts
   export interface PagedResult<T> {
     items: T[];
     page: number;        // 1-based
     pageSize: number;
     totalCount: number;
   }
   export type PatientSortField = "lastName" | "firstName" | "mrn" | "dob";
   export type SortDirection = "asc" | "desc";
   ```
2. **Server** `GET /api/patients` query params: `page` (default 1), `pageSize` (default 25, max 100 — clamp, don't error), `sortBy` (default `lastName`), `sortDir` (default `asc`), **`search`** (case-insensitive `Contains` against Mrn/FirstName/LastName), plus any filters that already exist by now (e.g. `providerId` from Task 02 — preserve them). The endpoint currently hardcodes `IsActive == true` and takes no params. Invalid `sortBy` ⇒ 400. Implement ordering with a whitelist switch (never build SQL/ordering from raw user strings), `Skip/Take`, and a `CountAsync` for `totalCount`. Secondary sort key `LastName, FirstName` for stable ordering when the primary is non-unique.
   - `search` moves server-side because the manage page's current client-side filter (`routes/patients/manage.tsx`) only sees the fetched page once pagination exists — replace that client-side filtering with the server param (debounced ~300ms, reset to page 1 on change).
3. **API client:** `patientsApi.list` takes an options object `{ page?, pageSize?, sortBy?, sortDir?, search?, providerId? }`, returns `PagedResult<Patient>`. Update the return type — this is a **breaking contract change**: fix every consumer (`get-patients.ts`, `routes/patients/index.tsx`, `routes/patients/manage.tsx`, delete/update mutation invalidations, and anything added by earlier tasks) in the same change.
4. **Client** (`apps/sona.client`) — both patient pages:
   - `patientsQueryOptions` becomes a function of the list params; query key includes them (`['patients', params]`). Check every existing `invalidateQueries({ queryKey: ['patients'] })` still matches (prefix invalidation — it will, but verify).
   - Put page/sort/search state in the route's **search params** (TanStack Router `validateSearch` on both `src/routes/patients/index.tsx` and `manage.tsx`) so state survives reload — idiomatic TanStack Router; do not reach for a store. Wire the manage page's existing `SearchInput` to the route search param instead of its `useState`.
   - UI: column headers for Name/MRN/DOB toggle sort (with an asc/desc indicator); Prev/Next + "Page X of Y" from `totalCount`. Convert the index page's `<ul>` list to a table if that's the cleanest way to get headers — keep existing row content (name, app/SMS line, NotifyPatientButton and anything later tasks added); the manage page already renders a table-like list — give it the same header/sort/pager treatment.
5. Keep `useSuspenseQuery` + route loader pattern (`ensureQueryData` with the params from search).

## Out of scope

Infinite scroll, cursor pagination, client-side sorting fallbacks, new filter facets beyond what already exists (search + providerId).

## Definition of Done

Per `_context.md`. No server sort path concatenates user input into ordering (whitelist verified). `pnpm build` passes — search-param typing errors surface here.
