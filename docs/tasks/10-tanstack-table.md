# Task 10 — TanStack Table for all tabular data rendering

> **BLOCKED — do not start yet:** the user will supply a reusable table component they already built in another project when this task begins. Wait for it; build the shared table wrapper around/from that component rather than designing one from scratch. If it hasn't been provided when you're asked to start, stop and ask for it.

**Prerequisite:** Task 06 (pagination + sorting) merged — this task builds on its server-driven paging/sorting contract and replaces parts of its UI layer.
Read `docs/tasks/_context.md` and `AGENTS.md` first.

## Goal

Every data rendering that uses a table adopts a single TanStack Table (`@tanstack/react-table`) implementation, based on the user-provided reusable component. Hand-rolled `<table>` markup and the ad-hoc header/sort plumbing go away.

## Current state (as of the `pagination-sorting` branch, 2026-08-31)

Tables are hand-rolled `<table>` JSX in three places:

1. `src/routes/patients/index.tsx` — patients list (sortable Name/MRN/DOB headers, History expandable row, `NotifyPatientButton` actions column).
2. `src/routes/patients/manage.tsx` — patient CRUD table (sortable headers, Edit/Delete actions).
3. `src/features/notifications/components/notification-history.tsx` — per-patient history panel (channel/status/created/sent/delivered, failure-reason tooltip; not sorted/paged — data set is small).

Shared helpers created in Task 06 that this task supersedes:

- **`src/components/sortable-header.tsx` — will probably be REPLACED by this task.** TanStack Table's header/`SortingState` model covers what it does (clickable `<th>`, asc/desc indicator, `aria-sort`). Delete it once no consumer remains — do not leave it as dead code.
- `src/components/pagination-controls.tsx` — keep or fold into the table component, whichever the provided component makes cleaner; same delete-if-orphaned rule.

## Requirements

1. **Dependency:** `pnpm --filter sona.client add @tanstack/react-table` (latest stable). Client-only — no contract, api-client, or server changes; Task 06's `PagedResult`/`sortBy`/`sortDir` contract is the interface and must not change.
2. **Shared component:** integrate the user-provided reusable table into `src/components/` (feature-agnostic, per bulletproof-react — features may use it, it imports from no feature). Adapt it to this repo's idioms: Tailwind v4 classes matching existing styling, TS strict, no `enum`/namespace (TS 6 `erasableSyntaxOnly`).
3. **Server-driven state stays server-driven:** the patients tables use **manual** sorting/pagination (`manualSorting: true`, `manualPagination: true`) — TanStack Table renders and manages column/`SortingState` UI state, but sorting/paging is executed by the API via the existing route search params (`validateSearch` from Task 06). Do not let the table client-sort a page of server-paged data. `SortingState` maps to/from the `sortBy`/`sortDir` search params; page state stays in search params too.
4. **Migrate all three tables** listed above. Preserve current behavior exactly: expandable History row on the index page (TanStack Table row-expansion or a rendered sub-row — simplest that works), actions columns, debounced search, "Page X of Y", `aria-sort`. Notification history can use the same component with sorting/pagination features off.
5. **Column defs live with their feature** (e.g. `features/patients/components/…` or alongside the route), not in `src/components/` — the shared component takes columns + data + state handlers; it owns rendering, not domain shape.
6. **Cleanup:** remove `sortable-header.tsx` (and `pagination-controls.tsx` if absorbed) once unreferenced. No leftover hand-rolled `<table>` markup for data rendering.
7. **Docs:** update `docs/patient-tasks.md` and this folder's `_context.md` client-state section (the "match these patterns" reference should point at the new table component).

## Out of scope

Column resizing/reordering/visibility toggles, row virtualization, client-side filtering (search stays server-side per Task 06), new columns or new data, mobile app (RN — TanStack Table DOM rendering doesn't apply there).

## Definition of Done

Per `_context.md` (client-only: `pnpm typecheck` + `pnpm build`). All three tables render through the shared TanStack Table component; sorting/paging on the patients tables still round-trips through the server exactly as Task 06 shipped it (verify the network params, not just the UI); `sortable-header.tsx` deleted or a stated reason it survived.
