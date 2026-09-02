# Task 18 — Decide and implement the Providers page role gate

**Prerequisites:** Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/admin-ui-guide.md` § Roles and § `/providers/manage`. Task 08 (roles) merged. Found 2026-09-02.

## Problem

`routes/providers/manage.tsx` carries `// @TODO: Lock behind user access level` and has **no client-side gate**: every assigned role (including `staff`) sees the Providers nav link, the page, **Add Provider**, Edit and Deactivate. The server side matches — `ProvidersController` is `[Authorize(Policy = AssignedUser)]` on every action, so staff can create, rename and deactivate providers for their org today. Every other admin surface (users, org structure, organizations) gates on `org_admin`/`system_admin` both client-side (UX) and server-side (policy). Patients are deliberately open to staff (that is their job); providers are reference data and were probably meant to be admin-only, but nobody decided.

## Decision needed (human, before implementing)

Pick one and record it in `docs/data-model.md` next to the `Role` row:

- **A. Admin-only (recommended):** `Providers` nav + `/providers/manage` visible to `org_admin` and `system_admin` only; staff get the gate text like the other admin pages. Server: `POST`/`PUT /api/providers` move to `Policies.OrgAdmin`; `GET /api/providers` stays `AssignedUser` (the patient form and filter need the list).
- **B. Staff read-only:** staff keep the page but without Add/Edit/Deactivate (list only, plus search). Server as in A.
- **C. Status quo, documented:** remove the `@TODO`, state in the guide that provider CRUD is intentionally open to staff.

## Requirements (for A or B)

1. **Server** (`apps/sona.server/Controllers/ProvidersController.cs`): per-action `[Authorize(Policy = Policies.OrgAdmin)]` on create/update. `dotnet build` passes. Cross-org checks unchanged.
2. **Client:** `components/header.tsx` hides `header-nav-providers` for staff (A only); the route renders `providers-forbidden` ("Only organization administrators can manage providers.") for A, or hides the toolbar button and row actions for B. Use `useUser()` like `routes/user-management/index.tsx` does — UX only, the server policy is the real gate.
3. **Guide:** update the role table, the `/providers/manage` "Who can see it" line and the testid list (`providers-forbidden` is new); remove the `@TODO` bullet from **Known gaps**.
4. Tests (Task 12 toolchain if landed): unit for the header link visibility per role; Playwright for the staff gate.

## Verification (Local; switch roles per the guide's SQL snippet)

| # | Role | Expected |
|---|---|---|
| 1 | system_admin / org_admin | Providers nav visible, page and CRUD work as today |
| 2 | staff | A: no nav link, direct URL → gate text; B: list + search only. `POST /api/providers` via curl as staff → `403` |
| 3 | staff | Patients → Add Patient → Primary Provider select still lists providers (`GET` stays open) |

## Out of scope

Provider-to-user linking (`appUserId`), "providers see only their own patients" scoping.

## Definition of Done

Per `_context.md`: `pnpm typecheck` + `pnpm build` + `dotnet build` pass; table executed; guide + data-model updated in the same commit; tick in `docs/patient-tasks.md`; delete this prompt.
