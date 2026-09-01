# Sona — Patient Management Task List

> **Agent prompts:** each open task has an implementation prompt in [`docs/tasks/`](tasks/) (start with [`_context.md`](tasks/_context.md)).
>
> **Audit trail:** an earlier version of this file flagged the checked tasks below as missing — they lived on `feat/patient-functionality`, merged to `main` (b958983) on 2026-08-20 and re-verified there. Two findings from that audit stood on `main`: the broken EF migration baseline (Task 00 — **fixed 2026-08-27**, baseline rebuilt as a single `InitialCreate`; Azure dev db needs a one-time history reconciliation, see `docs/getting-started.md`) and the absent notifications backend (Task 03 — shipped 2026-08-27, prompt deleted). One new bug found post-merge: `notifyPatientSchema` validates `patientId` as `.uuid()` but real patient ids are int-strings — fixed in Task 03.

## Task order (reassessed 2026-08-31)

Done: Task 00 (migration baseline, 2026-08-27), Task 02 (provider assignment, verified 2026-08-27), Task 03 (notifications backend + history, 2026-08-27), Task 04 (notify confirmation, 2026-08-31) — all prompts deleted.

| Order | Task | Prompt | Why here |
|---|---|---|---|
| 1 | Org hierarchy + user management, **schema + scoping only (8a–8c)** | tasks/08 *(prompt deleted)* | Schema changes get riskier as data grows (org backfill, composite MRN index); tenant isolation (8c) must exist before a second org's data enters |
| 2 | Real SMS dispatch via Webex Connect | tasks/07 *(prompt deleted)* | The "patient actually gets a text" milestone; depends on 03 (merged); after 8c so sends are born org-scoped |
| 3 | Org hierarchy UI, **8d–8e** (user management, org structure, system admin) | tasks/08 *(prompt deleted)* | Admin surfaces on a settled, enforced schema |
| 4 | Pagination + sortable columns + server-side search (merged) | tasks/06 *(prompt deleted)* | Pure scale/UX — schedule whenever lists get slow |
| 5 | TanStack Table adoption — **shipped 2026-08-31** | tasks/10 *(prompt deleted)* | User-provided component arrived 2026-08-31; migrated to v9 and adopted by all three tables |
| 6 | Bulk CSV import — **deferred** | [tasks/09](tasks/09-bulk-csv-import.md) | Blocked on the provider's import file docs (format unknown); was Task 05. Also after 8a so imports stamp `OrganizationId` from day one |
| 0 | **Bug:** user invite/assign form unusable against the seeded org (zod v4 `.uuid()` vs seed ids, missing org refinement on invite, hidden-field error blocks submit) | [tasks/11](tasks/11-user-invite-form-bugs.md) | Blocks provisioning any user through the UI — do first |
| 0 | **Frontend tests** (Vitest unit/component + Playwright E2E, CI workflow) | [tasks/12](tasks/12-frontend-unit-tests.md) | No automated tests exist; DoD is compile-only. Regression test for Task 11 comes with it |
| 0 | **Azure-free local mode** for the API (`Local` env: local SQL, stub auth) | [tasks/13](tasks/13-local-dev-without-azure.md) | API cannot start without HCA Azure creds, so UI is never exercised on personal machines; gated so the work repo is unaffected |
| 0 | **Admin UI guide + verification playbook** (route/interaction map, `data-testid` registry) | [tasks/14](tasks/14-admin-ui-guide-for-verification.md) | Agents and Playwright need stable selectors and known click paths; do after 13, before 12 §3 |

Rows sharing an order number are parallelizable; higher numbers depend on lower ones being merged. Ordering assumes multiple practices/hospital onboarding is the near-term goal; if the goal shifts to a single-practice pilot sending real texts ASAP, pull 07 ahead of 08a–8c (single-org world works fine; the default-org backfill catches up later).

## High Priority

- [x] **Search & filter patients** — search by name/MRN on both patient pages, **server-side since tasks/06 shipped 2026-08-31** (`search` query param, debounced, case-insensitive against MRN/first/last name). Filters for active/inactive, app status, SMS consent not yet built.
- [x] **Duplicate MRN validation** — server returns 409 on create and update; unique `Mrn` index migration in place. *(verified on `main` 2026-08-20)*
- [x] **SMS consent date stamping** — server stamps on first consent, preserves on repeat, clears on revoke; schemas never accept `smsConsentDate`. *(verified on `main` 2026-08-20)*
- [x] **Convert patient form to TanStack Form** — `patient-form.tsx` + shared `Form/` field components, zod validation from `@sona/shared`. *(verified on `main` 2026-08-20)*
- [x] **Provider-to-patient assignment** — `Provider` table, `Patient.PrimaryProviderId`, assignment UI + provider filter shipped. *(verified on `main` 2026-08-27; task prompt deleted)* Per-login "providers see only their assigned patients" scoping was explicitly out of scope — org/role-based scoping arrives with tasks/08 *(prompt deleted)*.

### Design Notes: Provider–Patient Assignment (audited 2026-08-20)

**Problem:** Every patient should have an assigned provider, so provider-role users can see a scoped list and sends can be attributed to the treating provider.

**Audit corrections to the original proposal (checked against the code on `main`):**

1. **"Provider = AppUser with role `provider`" does not match the schema.** `AppUser` (`apps/sona.server/Data/DbModels/AppUsers/AppUser.cs`) has no `Role` column — authorization is `AccessLevelId → AccessLevels`. More importantly, product direction is that front-desk staff send pings *on behalf of* providers/nurses, and some providers may never log into the admin at all. The login account (AppUser) and the clinical assignee (Provider) are different concepts — modeling the assignment against AppUser conflates them and breaks the moment a non-login provider needs patients assigned.
2. **ID types were wrong.** The proposal used `uuid` FKs, but the implemented `AppUser.Id` and `Patient.Id` are `int` identity columns. (Note: this itself contradicts `docs/data-model.md` conventions — "Primary keys are UUIDs" — and the committed `EntityBase` with `Guid.CreateVersion7()`, which `AppUser`/`Patient` don't inherit. Open decision below.)
3. **Cardinality is more than the requirement needs.** Requirement is "every patient has a provider" (one, nullable while backfilling). A many-to-many join table with assignment history is a fine future shape, but it front-loads UI (multi-select, unassign flows) and query complexity that a single FK avoids. Migrating FK → join table later is mechanical.
4. **`IsActive` + `UnassignedAt` in the proposed join table encode the same state twice** — if the join table is ever built, keep `UnassignedAt` (null = active) and drop `IsActive`.

**Decided approach — `Provider` directory table + single nullable FK on `Patient`:**

**Provider** (new table)

| Field | Type | Notes |
|---|---|---|
| `Id` | int PK (match current AppUser/Patient convention — or Guid via `EntityBase` if the PK decision flips) | |
| `FirstName` | string, required | |
| `LastName` | string, required | |
| `Credentials` | string, nullable | `MD`, `DO`, `NP`, `PA`, `RN` — display only |
| `Npi` | string(10), unique, nullable | National Provider Identifier — canonical business key; needed for Cerner matching later. Nullable: RNs and some staff have none |
| `Specialty` | string, nullable | ⚠️ Fine at rest, **never in SMS/push content** — "your oncologist is ready" leaks a condition ([compliance.md](compliance.md)) |
| `AppUserId` | int FK → AppUser, nullable | Set when the provider also has a login ("may be both" — some providers log in, some don't) |
| `IsActive` | bool, default true | Deactivate, never delete — assigned patients keep a valid reference; deactivation needs a reassignment workflow |
| `CreateDate` / `ModDate` | datetime | |

**Patient** (add column)

| Field | Type | Notes |
|---|---|---|
| `PrimaryProviderId` | int FK → Provider, **nullable** | Nullable by decision: flat-file imports may not carry a provider, existing rows need backfill. Named `Primary…` now so an encounter-level provider (Cerner, Enhancement 1) can coexist without renaming |

Contact fields (email/phone) on Provider: deliberately omitted for now — directory-only until a concrete need appears (undecided product-side).

**Attribution note:** `MessageOut.SentByUserId` stays "who clicked send" (the front-desk AppUser). If audit later needs "on whose behalf", add nullable `MessageOut.OnBehalfOfProviderId` — do not overload `SentByUserId`.

**Implementation steps:**
1. **DB:** `Provider` entity + `Patient.PrimaryProviderId` + EF migration. ⚠️ Before adding the migration, resolve the existing migration drift: `20260811191806_InitialCreate` has an **empty `Up()`** while `ApplicationDbContextModelSnapshot` already contains `AppUsers`/`Patients`/`AccessLevels` — a fresh database cannot be rebuilt from the committed migrations. Fix the baseline first or the new migration compounds it.
2. **Shared contract:** `Provider` type + `createProviderSchema` in `packages/shared`; add `primaryProviderId: string | null` (or number — see PK question) to `Patient` and the patient schemas.
3. **API:** `GET/POST /api/providers` (list + create), `PUT /api/patients/{id}` accepts `primaryProviderId`; `GET /api/patients?providerId=` for the scoped list.
4. **API client:** typed functions in `packages/api-client/src/endpoints.ts`.
5. **Admin UI:** provider select on the patient form (nullable), provider column/filter on the patient list; minimal provider CRUD (or seed list) so the select has data.
6. **Scoping (future):** "My patients" view for logged-in users linked via `Provider.AppUserId`.

**Deferred (revisit when needed):** many-to-many `ProviderPatient` join table with `AssignedAt`/`UnassignedAt` history — the original proposal above is the right v2 shape (minus the redundant `IsActive`) once care teams (attending + specialist) or assignment history become real requirements.

**Open questions:**
- **PK convention:** implemented tables use `int` identity; `docs/data-model.md` and `EntityBase` say Guid v7. Pick one before adding more tables — Provider will follow whichever wins.
- Should assignment be required before sending a notification, or advisory-only at first?
- Does Cerner integration (Enhancement 1) auto-create/overwrite `PrimaryProviderId` from attending physician data, or is that encounter-level only?
- Provider contact fields (email/phone) — needed, or directory-only?

## Medium Priority

- [ ] **Bulk patient import** — **Deferred 2026-08-31**: blocked until the provider's import file documentation arrives (CSV format unconfirmed). Support importing patients via flat file (CSV) upload, aligning with the `flatfile` import source *(prompt: [tasks/09](tasks/09-bulk-csv-import.md), was tasks/05)*
- [x] **Notification history per patient** — Task 03 shipped 2026-08-27: `NotificationsController` (`POST /api/notifications/ready` with TCPA gate + audited `MessageOut` row on every attempt, `GET /api/patients/{id}/notifications`), `MessagesOut`/`MessageTemplates` tables + seeded `ready-to-be-seen` template, history panel on the patients list. Dispatch is a logging stub until tasks/07 *(prompt deleted)*.
- [x] **Confirmation before notifying** — Task 04 shipped 2026-08-31: accessible confirm dialog (generic `ConfirmDialog` in `src/components/`) before the notify mutation fires; `NotifyPatientButton` feature component restored as the route's composition point. *(prompt deleted)*
- [ ] **Bug: user invite/assign form** — "Invalid UUID" on the seeded default org (zod v4 `.uuid()` is RFC-strict; seed ids `1111…`/`2222…`/`3333…` fail the variant check), invite schema never requires an org so the 400 only toasts, and switching to `system_admin` leaves a stale hidden `organizationId` that silently blocks submit *(prompt: [tasks/11](tasks/11-user-invite-form-bugs.md))*
- [ ] **Frontend tests** — Vitest + Testing Library + MSW (unit/component) and Playwright E2E against the Local API, `pnpm test`/`pnpm e2e` wired into turbo + a CI workflow that finally runs typecheck/build/test/e2e; first tests target the schemas, forms and flows behind Task 11 *(prompt: [tasks/12](tasks/12-frontend-unit-tests.md))*
- [ ] **Run the API without Azure (`Local` profile)** — env-gated local SQL connection string, console-only Serilog, `LocalDevAuth` scheme replacing Entra, Local-only seed; Development/Production paths untouched so the work repo is unaffected *(prompt: [tasks/13](tasks/13-local-dev-without-azure.md))*
- [ ] **Admin UI guide + verification playbook** — `docs/admin-ui-guide.md` mapping every route/region/interaction/API call/role gate, a `data-testid` convention applied across the admin, and the steps an agent runs before declaring frontend work done *(prompt: [tasks/14](tasks/14-admin-ui-guide-for-verification.md))*
- [x] **SMS via Webex Connect** — Task 07 shipped 2026-09-01: `WebexConnectUtil` hardened (DI singleton, named `IHttpClientFactory` client, lazy Key Vault fetch, `SmsSendResult` with provider `messageId`, PHI-free logging) and wired to `ISmsSender` via `WebexSmsSender`. Unconfigured environments still start; sends audit as `failed`/`sms-not-configured`. ⚠️ Real `WebexConnect` config values still pending from the team; **BAA with Webex/Cisco unconfirmed — launch blocker** *(prompt: tasks/07 *(prompt deleted)*)*

## Lower Priority

- [x] **Pagination** — Task 06 shipped 2026-08-31: `GET /api/patients` returns `PagedResult<Patient>` (`page`/`pageSize` params, pageSize clamped to 100); Prev/Next + "Page X of Y" on both patient pages, page state in route search params *(prompt: tasks/06 *(prompt deleted)*, merged with sorting)*
- [x] **Sortable columns** — Task 06 shipped 2026-08-31: server-driven sort (`sortBy` whitelist: lastName/firstName/mrn/dob + `sortDir`, secondary LastName/FirstName for stable paging); clickable Name/MRN/DOB headers with asc/desc indicator on both patient pages. "Last notified" sort not included (needs a join — add when wanted) *(prompt: tasks/06 *(prompt deleted)*)*
- [x] **TanStack Table adoption** — Task 10 shipped 2026-08-31: shared `src/components/Table/Table.tsx` + `Pagination.tsx` (user-provided component, migrated to `@tanstack/react-table` v9 `useTable`/`tableFeatures`). Patients index + manage use manual (server-driven) sorting/pagination via search params, with a page-size selector (new `pageSize` param, server clamp 100); notification history uses client mode with sorting/paging off. `sortable-header.tsx` and `pagination-controls.tsx` deleted *(prompt: tasks/10 *(prompt deleted)*)*
