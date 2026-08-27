# Task 08 — Organization hierarchy + user management

**Prerequisites:** Read `docs/tasks/_context.md` and `AGENTS.md` first. The migration baseline was rebuilt 2026-08-27 (single `InitialCreate` in `Data/Migrations/`) — add new migrations with `--output-dir Data/Migrations`. Coordinates with Task 03 (`MessageOut` registration) — see 8a step 6.

This doc is the design spec + implementation plan. It is split into **five sub-tasks (8a–8e), each sized for one agent session, landed in order**. Do not attempt the whole thing in one pass. Re-verify current repo state at the start of each sub-task — earlier sub-tasks (and unrelated tasks) may have landed since this was written (2026-08-27).

## Goal

Users are managed by the practice (organization) they belong to. A practice is the simple case; a hospital is the same structure with more rows: multiple sites (campuses) and departments (ED waiting, Lab, Imaging — any unit that messages patients directly). Org admins manage their own users; a system admin creates organizations.

## Design decisions (settled — do not re-litigate)

1. **Fixed 3-level chain: `Organization → Site → Department`.** No generic self-referencing tree, no Region table. Every org always has ≥1 site and each site ≥1 department: creating a practice auto-creates a "Main" site + "General" department. UI hides a level while only one row exists at it. If a health-system grouping is ever needed, it becomes a nullable `Organization.ParentOrganizationId` later — not now.
2. **Department = the unit that messages patients.** Everything above department is admin/grouping structure.
3. **Single-org users (MVP).** A user belongs to at most one organization, so role is a plain column: `AppUser.Role` = `system_admin | org_admin | staff | unassigned` (TS union type in `@sona/shared`; no C# `enum` in the contract — string constants server-side). This replaces the `AccessLevels` table. If multi-org membership ever happens, `Role` splits into a scoped assignment table — clean migration path, not needed now.
   - `system_admin`: Sona/HCA internal. `OrganizationId` is null; sees everything; the only role that creates organizations.
   - `org_admin`: manages users, sites, departments, and providers within their org. Org-wide access implied — needs no department rows.
   - `staff`: sends notifications; sees patients only. Department scoping via `UserDepartmentAccess`.
   - `unassigned`: authenticated but not yet provisioned — sees nothing but a "pending approval" screen.
4. **`UserDepartmentAccess` join table** (`AppUserId`, `DepartmentId`) scopes `staff` in multi-department orgs. A float nurse gets multiple rows. Practice staff get one auto-row in "General". Only meaningful for `staff`.
5. **Patients belong to the organization only** — `Patient.OrganizationId`, never a department FK. Department association is captured per-send: `MessageOut.DepartmentId` (nullable) records which department sent the ping. When Cerner lands (Enhancement 1), visit-level department goes on `Encounter`.
6. **A person seen at two practices = two `Patient` rows, one per org. Deliberate.** A patient row is "this practice's record of a person," not a global human. Tenant isolation demands it (practice A must never see practice B's list), and `SmsConsent` is legally per-practice (TCPA). Consequence: the current **global** unique index on `Mrn` becomes composite unique `(OrganizationId, Mrn)` — MRN schemes can collide across orgs. Person-level identity (one human ↔ many patient rows) becomes relevant only for the Enhancement 2 mobile app; defer it.
7. **User onboarding = invite-first, JIT-approval fallback.** Org admin searches the HCA directory (existing `MSGraphHelper`) and pre-provisions a user with org + role + departments. Anyone else who signs in via Entra lands as `unassigned` (note: `AppUserUtil.CheckAndSetEmployee` currently JIT-creates with `AccessLevels.Standard` — this changes to `unassigned`) and appears in the org admin's pending queue. Auth stays single-tenant HCA Entra — multi-tenant auth is explicitly out of scope.
8. **All role/scope checks are server-side** (compliance rule). Client role checks are UX only.

## Target schema (delta)

New tables (all `EntityBase`: Guid v7 PK + `CreateDate`/`ModDate`; UTC stamping already in `ApplicationDbContext` — verify, see `_context.md`):

| Table | Fields |
|---|---|
| `Organization` | `Name` (required, max 200), `Type` (`practice` \| `hospital`), `IsActive` (default true) |
| `Site` | `OrganizationId` (Guid FK, Restrict), `Name` (required, max 200), `IsActive` |
| `Department` | `SiteId` (Guid FK, Restrict), `Name` (required, max 200), `IsActive` |
| `UserDepartmentAccess` | `AppUserId` (int FK → AppUser, Cascade), `DepartmentId` (Guid FK → Department, Cascade), unique `(AppUserId, DepartmentId)` |

Changed tables:

| Table | Change |
|---|---|
| `AppUser` | + `Role` (string, required, default `unassigned`); + `OrganizationId` (Guid?, FK Restrict — null for `system_admin`/`unassigned`); − `AccessLevelId` (+ drop `AccessLevels` table); `EmpDept` stays for now (informational MSGraph string) but is no longer authorization data |
| `Patient` | + `OrganizationId` (Guid, required FK, Restrict); MRN unique index: drop global, add composite unique `(OrganizationId, Mrn)` |
| `Provider` | + `OrganizationId` (Guid, required FK, Restrict) |
| `MessageOut` (entity file only — not yet registered) | + `DepartmentId` (Guid?, FK) — sender's department at send time, audit |

---

## 8a — Schema + backfill migration + role plumbing (server only)

1. New entities `Data/DbModels/Orgs/Organization.cs`, `Site.cs`, `Department.cs`, `UserDepartmentAccess.cs` per the table above; register `DbSet`s; relationships + indexes in `OnModelCreating`.
2. `AppUser`: add `Role` (string) + `OrganizationId` (Guid?) + `Departments` nav via `UserDepartmentAccess`; remove `AccessLevelId`/`GetAccessLevel`. Delete `AccessLevel.cs`, its `DbSet`, and the `AccessLevels` enum in `Models/Commons/Constants.cs` — replace with a `UserRoles` static class of string constants (`erasableSyntaxOnly` does not apply to C#, but keep parity with the TS union: `system_admin`, `org_admin`, `staff`, `unassigned`).
3. `Patient.OrganizationId` (Guid, required) and `Provider.OrganizationId` (Guid, required).
4. **One migration** that: creates the new tables; seeds one default org (`Name: "Default Practice"`, `Type: practice`) + "Main" site + "General" department with fixed literal Guids in the migration (not `Guid.NewGuid()` — migrations must be deterministic); backfills `Patient.OrganizationId` / `Provider.OrganizationId` to the default org (raw SQL `migrationBuilder.Sql` UPDATE before adding the NOT NULL constraint); backfills `AppUser`: `Role = 'staff'` where `AccessLevelId = 2` (Standard), `'unassigned'` otherwise, `OrganizationId` = default org for existing non-unassigned users; drops `AccessLevelId` + `AccessLevels`; swaps the MRN index to composite `(OrganizationId, Mrn)`.
5. Update the two consumers of `AccessLevelId`: `AppUserUtil.CheckAndSetEmployee` (JIT default becomes `Role = "unassigned"`, no org) and `CurrentUserService` (`CurrentUserDto.AccessLevel` → `Role`; add `OrganizationId` and `DepartmentIds` to the DTO — controllers will need them in 8c).
6. Edit the **unregistered** `Data/DbModels/Messaging/MessageOut.cs` file: add `DepartmentId` (Guid?). No migration for it (table doesn't exist yet); Task 03 inherits the field when it registers the entity. If Task 03 has already landed by the time you do this, add the column in this migration instead.
7. `UserController.GetCurrentUser` keeps working (returns the updated DTO). Client `features/user/getUser.ts` + any consumer of `accessLevel` updated to `role`.

**Done:** `dotnet build Sona.slnx` passes; migration `Up()` visibly does all of step 4; `pnpm typecheck` passes (client DTO consumers updated).

## 8b — Contract + org/user endpoints

1. `packages/shared`: `UserRole` union, `Organization`/`Site`/`Department` types (string ids), `AppUserSummary` (id number, name, email, role, organizationId, departmentIds), zod schemas: `createOrganizationSchema` (name, type), `createSiteSchema`, `createDepartmentSchema`, `updateUserSchema` (role, organizationId, departmentIds — refine: `staff` requires ≥1 department when org has >1; `system_admin` cannot have an org). Replace the old `User`/`UserRole` remnants in `types.ts` if they conflict.
2. Server — role authorization: policies `SystemAdmin`, `OrgAdmin` (system_admin passes too), `AssignedUser` (any role except `unassigned`) built on `CurrentUserService`. Apply to controllers below and — minimal placeholder — `[Authorize(Policy = "AssignedUser")]` on `PatientsController`/`ProvidersController` (full org filtering is 8c).
3. New `OrganizationsController`:
   - `GET /api/organizations` — system_admin: all; org_admin: own org only.
   - `POST /api/organizations` — system_admin; auto-creates "Main" site + "General" department in the same transaction.
   - `GET/POST/PUT` sites + departments nested under the org (`/api/organizations/{id}/sites`, `/api/sites/{id}/departments` — follow `ProvidersController` style); org_admin scoped to own org; deactivate, never delete.
4. New `UsersController` (rename/extend existing `UserController` — keep `GET /api/user` working):
   - `GET /api/users` — org_admin: users in own org **plus** all `unassigned` users (the pending queue); system_admin: all. Optional `?role=` filter.
   - `PUT /api/users/{id}` — assign org/role/departments per `updateUserSchema`. org_admin cannot grant `system_admin`, cannot modify users of another org, cannot change own role (lockout guard). Writes `UserDepartmentAccess` rows as a replace-set.
   - `GET /api/users/directory-search?q=` — org_admin; wraps existing `MSGraphHelper.GetUserDetails` search for invite-first flow; returns name/email/34Id only. **No PHI concern here, but never log the query string with results.**
   - `POST /api/users/invite` — org_admin; body = 34Id + role + departmentIds; creates the `AppUser` row pre-provisioned (JIT login then finds the existing row — verify `CheckAndSetEmployee` matches on HCAID and does not duplicate).
5. `packages/api-client`: `organizationsApi`, `usersApi` in `endpoints.ts`.

**Done:** all four TS packages typecheck; `dotnet build Sona.slnx` passes; endpoint auth verified by code review at minimum (state honestly what was executed vs reviewed).

## 8c — Tenant scoping enforcement (server)

The compliance-critical step: after this, no cross-org data access is possible.

1. `PatientsController`: every query filtered by current user's `OrganizationId` (system_admin: allow `?organizationId=` override). GET-by-id/PUT/DELETE on a patient of another org → 404 (not 403 — don't leak existence). POST stamps the creator's org. Duplicate-MRN 409 check becomes org-scoped (matches the composite index).
2. `ProvidersController`: same pattern. Provider dropdown data is org-scoped.
3. `unassigned` users: blocked from all patient/provider endpoints by the `AssignedUser` policy (verify it landed in 8b everywhere).
4. Import path (`ImportBatch`, if Task 05 landed): stamp `OrganizationId` on imported patients from the uploader's org.
5. Notification send path (if Task 03 landed): sender must share org with the patient; persist `MessageOut.DepartmentId` from the request (validated: department must belong to sender's org, and to sender's `UserDepartmentAccess` set when role is `staff`).
6. Tests or at minimum a manual verification matrix in the PR description: org_admin/staff of org A cannot read/write org B's patients by id.

**Done:** `dotnet build Sona.slnx`; every patient/provider query visibly carries the org filter.

## 8d — User management UI (admin)

Route stub `apps/sona.client/src/routes/user-management/` already exists (verify current contents first). Build `src/features/user-management/` (bulletproof-react — no imports from other features; reuse `src/components/Form/`):

1. `api/get-users.ts` (queryOptions), `api/update-user.ts`, `api/invite-user.ts`, `api/search-directory.ts` — mirror `features/providers/api/` patterns.
2. User list: name, email, role, departments; filter by role; pending (`unassigned`) users surfaced at top as an approval queue with an inline "assign" action.
3. Assign/edit dialog: role select + department multi-select (departments fetched org-scoped; hidden when org has one department). Validate with `updateUserSchema` via TanStack Form — no duplicate inline validation.
4. Invite flow: directory search box (debounced) → pick person → same role/department controls → `invite-user` mutation.
5. Gate the route client-side to `org_admin`/`system_admin` (UX only — server already enforces); `unassigned` users get a "pending approval" screen instead of the app shell (touches `__root.tsx` / user context).

**Done:** `pnpm typecheck` + `pnpm build` pass (route file regenerates `routeTree.gen.ts` — never hand-edit).

## 8e — Org structure UI + system admin surface

1. `features/org-structure/`: manage sites + departments for own org (org_admin) — list/add/rename/deactivate, following `routes/providers/manage` page structure. Hide the Sites level while the org has one site.
2. System admin: organizations page — list + create (name, type). Client-gated to `system_admin`, same admin app, own route (`/organizations`).
3. Header/user menu shows current org name; staff with multiple departments get a department context select (persist in a Zustand store in `src/stores/` — client state, not server state). The selected department is what 8c step 5 sends as `MessageOut.DepartmentId`. If Task 03/04 (send flow) is unmerged, wire the store now and leave a TODO reference to this doc where the send call will consume it.

**Done:** `pnpm typecheck` + `pnpm build`; docs updated (`docs/data-model.md` already covers the schema — tick this task in any tracking list).

---

## Out of scope (all sub-tasks)

Region/parent-org grouping, multi-org user membership, scoped role-assignment table, person-level patient identity / cross-org dedupe (Enhancement 2), Encounter/department-on-visit (Enhancement 1), multi-tenant Entra auth, provider-to-department assignment, deleting orgs/sites/departments (deactivate only).

## Compliance notes

- Org/site/department **names** are not PHI, but a department name can imply a condition ("Oncology waiting room"). Department names must therefore never appear in notification payloads, logs, or URLs — same rule as everything else (`docs/compliance.md`). `MessageOut.DepartmentId` (an opaque Guid, at rest) is fine; rendering the name into an SMS is not.
- Scoping checks are server-side. 404 (not 403) for cross-org entity access by id.
