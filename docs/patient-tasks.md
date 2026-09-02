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
| 0 | ~~**Bug:** user invite/assign form unusable against the seeded org (zod v4 `.uuid()` vs seed ids, missing org refinement on invite, hidden-field error blocks submit)~~ — **fixed 2026-09-02** | tasks/11 *(prompt deleted)* | Contract now validates ids with `z.guid()`; invite requires an org for org-scoped roles; the form resets hidden fields on role change and shows form-level/hidden-field errors |
| 0 | ~~**Frontend tests** (Vitest unit/component + Playwright E2E, CI workflow)~~ — **shipped 2026-09-02** | tasks/12 *(prompt deleted)* | `pnpm test` (37 schema + 34 component/route tests) and `pnpm e2e` (5 specs, `@smoke` subset in CI) are part of the DoD |
| 0 | ~~**Azure-free local mode** for the API (`Local` env: local SQL, stub auth)~~ — **shipped 2026-09-01** | tasks/13 *(prompt deleted)* | API could not start without HCA Azure creds, so UI was never exercised on personal machines; gated on `ASPNETCORE_ENVIRONMENT=Local` so the work repo is unaffected. See `docs/getting-started.md` § "Running locally without Azure (Local profile)" |
| 0 | ~~**Admin UI guide + verification playbook**~~ — shipped 2026-09-02 | [admin-ui-guide.md](admin-ui-guide.md) | Done; Playwright (12 §3) selects by the ids it registers |
| 7 | **Org hierarchy v2 + PatientLookup** (Division → Organization → Facility → Department, `Department.FacilityType`, drop `Organization.Type`, Divisions admin page; `PatientLookup` becomes the only store of MRNs) — spec'd 2026-09-02, questions resolved same day | [tasks/19](tasks/19-org-hierarchy-v2-and-patient-lookup.md) | Team review 2026-09-02 aligned the hierarchy with HCA's real structure; multiple MRN sources per patient are expected, so the crosswalk goes in while every patient still has one MRN. Two migrations, two PRs; `AuditLogs` change-tracking table is a separate follow-up. Before 09 so imports write lookup rows from day one |

Rows sharing an order number are parallelizable; higher numbers depend on lower ones being merged. Ordering assumes multiple practices/hospital onboarding is the near-term goal; if the goal shifts to a single-practice pilot sending real texts ASAP, pull 07 ahead of 08a–8c (single-org world works fine; the default-org backfill catches up later).

## High Priority

- [ ] **Org hierarchy v2 + PatientLookup** — Part A: Division above Organization (required, backfilled to a seeded default; system_admin admin page), Site → Facility, `Department.FacilityType` (inpatient/outpatient label, no gating), `Organization.Type` removed. Part B: `PatientLookup` keyed `(OrganizationId, AssigningAuthority, Mrn)` replaces `Patients.Mrn` (contract unchanged, `mrn` projected from the primary row; search matches any identifier). `AuditLogs` (change tracking, replaces the `CreateDate` idea) is a separate follow-up *(prompt: [tasks/19](tasks/19-org-hierarchy-v2-and-patient-lookup.md))*
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
- [x] **Bug: user invite/assign form** — Task 11 fixed 2026-09-02: every id in `packages/shared/src/schemas.ts` is `z.guid()` (SQL Server `uniqueidentifier`/seed ids are not RFC 4122, which zod 4's `.uuid()` enforces); `inviteUserSchema` requires an organization for org_admin/staff; the role listener resets `organizationId` for the new role; the form shows a `user-access-form-errors` summary for server rejections and hidden-field errors. *(prompt deleted)*
- [x] **Bug: notify/delete feedback on the patient pages** — Task 16 fixed 2026-09-02: `useNotifyPatient` toasts "Notification sent" / "Notification failed: {reason}" from the audited row and the server error on a 4xx; patient delete goes through the shared `ConfirmDialog` with an error toast; provider select default is `''` (no null-`value` warning); `getErrorMessage` lives in `src/lib/api-error.ts` instead of five route copies. *(prompt deleted)*
- [x] **`pnpm lint` passes** — Task 17 fixed 2026-09-02: mobile declares `eslint` 9 + `eslint-config-expo` with a committed flat `eslint.config.js` (`unrs-resolver` build allowed in `pnpm-workspace.yaml`, so `expo lint` no longer mutates the tree); `packages/shared` and `packages/api-client` lint with oxlint; the client's `react/only-export-components` warnings are gone (route components exported, `MyRouterContext` moved to `src/types/router.ts`, `SubscribeButton` uses JSX children); CI runs `pnpm lint`. *(prompt deleted)*
- [x] **Providers page role gate** — Task 18 decided **admin-only** 2026-09-02: `POST`/`PUT /api/providers` require the `OrgAdmin` policy (`GET` stays open for the patient form/filter); the Providers nav is hidden for staff and `/providers/manage` shows `providers-forbidden`. Recorded in `docs/data-model.md` (Role row). *(prompt deleted)*
- [x] **Frontend tests** — Task 12 shipped 2026-09-02: Vitest + Testing Library + MSW (`packages/shared` schemas incl. the seed-id regression, `UserAccessForm`, `PatientForm`, `NotifyPatientButton`, `Table`, the `/user-management` route on a memory history) and Playwright E2E against the Local API (smoke, user management incl. the Task 11 matrix, patients create/search/edit/notify, tenant scoping, org structure) with a Local-only role-switch endpoint; `pnpm test`/`pnpm e2e` via turbo; `.github/workflows/ci.yml` runs typecheck/build/test/`dotnet build` + `@smoke` E2E. Found and fixed: editing a patient with no provider failed on "Invalid GUID". *(prompt deleted)*
- [x] **Run the API without Azure (`Local` profile)** — Task 13 shipped 2026-09-01: `ASPNETCORE_ENVIRONMENT=Local` uses a local SQL connection string from git-ignored `appsettings.Local.json`, console-only Serilog, the `LocalDevAuth` stub scheme instead of Entra, and an idempotent Local-only seed/JIT promotion. An Azure connection string is refused at startup and every branch is gated on `isLocal`, so Development/Production are unchanged. See `docs/getting-started.md` § "Running locally without Azure (Local profile)". *(prompt deleted)*
- [x] **Admin UI guide + verification playbook** — Task 14 shipped 2026-09-02: `docs/admin-ui-guide.md` maps every route/region/interaction/API call/role gate/empty state (verified in a running Local app), is the `data-testid` registry (`testId` prop on `Table`/`Pagination`/`SearchInput`/form fields with documented derivation; fixed ids on ConfirmDialog, header, forms, row actions), and opens with the verification playbook linked from AGENTS.md §4. *(prompt deleted)*
- [x] **SMS via Webex Connect** — Task 07 shipped 2026-09-01: `WebexConnectUtil` hardened (DI singleton, named `IHttpClientFactory` client, lazy Key Vault fetch, `SmsSendResult` with provider `messageId`, PHI-free logging) and wired to `ISmsSender` via `WebexSmsSender`. Unconfigured environments still start; sends audit as `failed`/`sms-not-configured`. ⚠️ Real `WebexConnect` config values still pending from the team; **BAA with Webex/Cisco unconfirmed — launch blocker** *(prompt: tasks/07 *(prompt deleted)*)*

## Lower Priority

- [x] **Pagination** — Task 06 shipped 2026-08-31: `GET /api/patients` returns `PagedResult<Patient>` (`page`/`pageSize` params, pageSize clamped to 100); Prev/Next + "Page X of Y" on both patient pages, page state in route search params *(prompt: tasks/06 *(prompt deleted)*, merged with sorting)*
- [x] **Sortable columns** — Task 06 shipped 2026-08-31: server-driven sort (`sortBy` whitelist: lastName/firstName/mrn/dob + `sortDir`, secondary LastName/FirstName for stable paging); clickable Name/MRN/DOB headers with asc/desc indicator on both patient pages. "Last notified" sort not included (needs a join — add when wanted) *(prompt: tasks/06 *(prompt deleted)*)*
- [x] **TanStack Table adoption** — Task 10 shipped 2026-08-31: shared `src/components/Table/Table.tsx` + `Pagination.tsx` (user-provided component, migrated to `@tanstack/react-table` v9 `useTable`/`tableFeatures`). Patients index + manage use manual (server-driven) sorting/pagination via search params, with a page-size selector (new `pageSize` param, server clamp 100); notification history uses client mode with sorting/paging off. `sortable-header.tsx` and `pagination-controls.tsx` deleted *(prompt: tasks/10 *(prompt deleted)*)*
