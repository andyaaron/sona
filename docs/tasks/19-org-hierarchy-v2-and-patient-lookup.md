# Task 19 — Org hierarchy v2 (Division / Facility / FacilityType) + PatientLookup + AuditLogs

**Status:** spec'd 2026-09-02 after team review; open questions resolved 2026-09-02 (§7). Ready to start.
**Prerequisite:** none — migration baseline fixed 2026-08-27; add migrations with `--output-dir Data/Migrations`. Run `dotnet ef` under the `Local` profile (`ASPNETCORE_ENVIRONMENT=Local`) so no Azure credentials are needed.
Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/data-model.md` (§ Organization hierarchy, § Multi-practice patients) and `docs/admin-ui-guide.md` (org structure + organizations pages) first.

## 1. Goal

Align the tenant hierarchy with the real-world structure — **Division → Organization → Facility → Department** — and add a care-setting label to departments.

Real-world example that drove the design: **North Carolina Division** (division) owns **Asheville Cardiology & Associates** (organization), which has facilities in **Asheville** and **Hendersonville**, some of which have both an **inpatient** and an **outpatient** department.

Second goal: introduce **`PatientLookup`** as the single home of patient identifiers, so a patient can carry MRNs from more than one source (practice EMR today; hospital EHR feeds, EMR migrations, chart merges later — Cerner itself is a future enhancement, not MVP). Decided 2026-09-02: the multi-source case is expected, so the structure goes in now while every patient still has exactly one MRN and the migration is trivial.

Third goal (added 2026-09-02): **`AuditLogs`** replaces per-table `CreateDate`/`ModDate`. No table carries timestamps; create / edit / delete of every entity is recorded in one audit table, following the pattern in the team's other apps.

Three parts, three migrations, three PRs. Part A is pure hierarchy; Part B moves MRN storage; Part C adds `AuditLogs` and drops the timestamp columns. Do not combine — the review surface is too large. **Order: C may ship before or after A/B, but A and B must not add `CreateDate`/`ModDate` to new tables.**

## 2. Decisions settled (do not re-litigate)

| Decision | Rationale |
|---|---|
| **Tenant boundary stays at `Organization`.** `DivisionId` goes on `Organization` only — never on `Patient`, `Provider`, `MessageOut`, `AppUser`. | Division is an ownership/reporting grouping. Cross-org patient visibility stays forbidden (tenant isolation, per-practice TCPA consent — `data-model.md` § Multi-practice patients). |
| **MRN is unique per organization** for the first tenant (confirmed 2026-09-02; a practice EMR has one MRN pool across its locations). Uniqueness is enforced on `PatientLookup (OrganizationId, AssigningAuthority, Mrn)`, where the assigning authority defaults to the org itself. | Assigning authority (HL7 PID-3 / FHIR `identifier.system`) absorbs a per-facility or external MRN pool later without a schema change. |
| **`Patient.Mrn` column is removed; `PatientLookup` is the only store of identifiers.** The API contract's `Patient.mrn` stays and is projected from the primary lookup row. | One source of truth — no dual writes, nothing to drift. Zero contract/client change. Cheapest to do now, while each patient has exactly one MRN. |
| **`Patient.OrganizationId` stays on `Patient`.** | Tenant column belongs on every tenant-owned row; needing a join to know the owner is how tenant leaks happen. |
| **Cross-org "same person" stays unlinked.** | A future `Person` layer (mobile app) — separate design, separate compliance review. |
| **`Department.FacilityType` is a label**, values `inpatient \| outpatient`. No send-path behaviour attached. | Confirmed 2026-09-02: needed for future filtering, not for gating. Column name kept for parity with existing HCA schemas even though it lives on `Department`. |
| **No `Coid`, no `Division.Code`.** | No current use (2026-09-02). Add when a consumer exists. |
| **No `CreateDate`/`ModDate` on any table** — including the existing `EntityBase` ones. `AuditLogs` records create / edit / delete for every entity (Part C). | Decided 2026-09-02. One audit mechanism, not two. `EntityBase` shrinks to the uuid v7 PK. |
| **Cerner is not MVP.** `Patient.InCerner` dropped (Part B), `cerner` removed from the `ImportSource`/`Source` value sets, `Encounter` stays on the diagram as a future-enhancement box only. `AssigningAuthority` remains — it is the hook a future EHR feed plugs into, not Cerner-specific. | Decided 2026-09-02. |
| **Patient mobile app shelved (not MVP).** `Patient.IsUsingMobileApp` dropped (Part B), `Device` table stays a shelved box, notifications are SMS-only: the notify path no longer branches on channel, `IPushSender`/`LoggingStubPushSender` are deleted, `MessageOut.Channel` column stays (audit) but only `sms` is ever written and the contract's `NotificationChannel` narrows to `"sms"`. | Decided 2026-09-02. `Channel` column kept so re-enabling push is additive. |
| **Import tables shelved.** `ImportBatch`/`ImportRowError` classes are deleted; the design is kept as a note in the DBML file for when flat-file import returns. `Patient.ImportBatchId` (bare guid today) is dropped in Part B. | Decided 2026-09-02. Nothing references them; Task 09 is deferred indefinitely. |
| **Roles unchanged.** No `division_admin`. | No user needs it yet. |
| **Division gets a real admin page** (system_admin), not just an API. | Decided 2026-09-02 (Q8). |
| **Patient keeps its `int` PK.** | PK change ripples through `MessageOut` FKs and the contract for no functional gain. |

## 3. Part A — hierarchy (one migration: `OrgHierarchyV2`)

### 3.1 `Division` (new, `EntityBase`)

| Field | Type | Notes |
|---|---|---|
| `Id` | uuid PK | |
| `Name` | string(200), required | e.g. "North Carolina Division". Unique (case-insensitive collation is the SQL Server default). |
| `IsActive` | bool, default true | |

- `Organization.DivisionId` — **required** uuid FK → `Division`, `Restrict` delete (a division with organizations cannot be removed).
- **Backfill:** the migration inserts a division with fixed id `22222222-2222-2222-2222-222222222222`, `Name = "Default Division"`, assigns every existing organization (including the seeded `11111111-…` org) to it, then makes the column `NOT NULL`. Same pattern as the Task 08 default-org backfill.

### 3.2 Remove `Organization.Type`

- Drop the column, the `practice | hospital` validation in `OrganizationsController` (create), the DTO field, `organizationTypeSchema` / `OrganizationType` in `packages/shared`, the type select in `features/org-structure/components/organization-form.tsx`, and the assertions in `e2e/org-structure.spec.ts`.
- The auto-created "Main" facility + "General" department on org create **stays**; it never branched on type (verified 2026-09-02 — nothing reads `Type` beyond validation and echo). No consumers outside this repo (Q9).

### 3.3 Rename `Site` → `Facility`

- Table `Sites` → `Facilities`; `Department.SiteId` → `FacilityId`; FK/index names follow. **The migration must use `RenameTable` / `RenameColumn` / `RenameIndex`** — inspect the scaffolded migration and replace any drop+create pair (EF scaffolds drop+create when the entity class is renamed). Data must survive.
- No new columns on `Facility`.

### 3.4 `Department.FacilityType`

- string(20), **required**, values `inpatient | outpatient`. DB check constraint `CK_Departments_FacilityType`. Migration backfills existing rows to `outpatient`; the auto-created "General" department is `outpatient`.
- XML doc comment on the property must say the name is kept for parity with existing HCA schemas, or the next reader will "fix" it.
- **No change in `NotificationsController`.**

### 3.5 API (Part A)

- **`DivisionsController`** — `GET /api/divisions` (any authenticated user; the org create form needs it), `GET /api/divisions/{id}`, `POST /api/divisions`, `PUT /api/divisions/{id}` (`SystemAdmin` policy). Validation: trimmed non-empty `Name`, 409 on duplicate name. `IsActive` toggled via `PUT` (no DELETE — restrict FK anyway). DTO: `{ id, name, isActive, organizationCount }`.
- **`OrganizationsController`** — `POST` requires `divisionId` (400 if missing/unknown/inactive). Organization DTO gains `divisionId` + `divisionName`. `GET /api/organizations` accepts `?divisionId=` filter (system_admin).
- **Facilities** — endpoints `/api/organizations/{id}/sites…` → `/facilities…`, request/response field `siteId` → `facilityId`.
- **Departments** — create requires `facilityType`; update accepts it. DTO gains `facilityType`.
- Style: follow `OrganizationsController` (Task 08) for shape, error bodies, org-scoping.

### 3.6 Contract + client (Part A)

- `packages/shared`: `Division` type; `Organization` gains `divisionId`/`divisionName`, loses `type`; `Site` → `Facility`, `siteId` → `facilityId`; `Department.facilityType`; `FacilityType = "inpatient" | "outpatient"` + `facilityTypeSchema`; `createOrganizationSchema` gains `divisionId: z.guid()`, loses `type`; `createDepartmentSchema`/`updateDepartmentSchema` gain `facilityType` (required on create, optional on update); `createDivisionSchema`/`updateDivisionSchema`. Schema tests for every new/changed schema (Vitest, `schemas.test.ts`).
- `packages/api-client`: `divisionsApi` (list/get/create/update), renamed facility functions, updated organization/department signatures.
- `apps/sona.client`:
  - New feature `features/divisions` (api: `get-divisions.ts`, `create-division.ts`, `update-division.ts`; components: list table via shared `Table`, create/edit form via TanStack Form + shared schemas) and route `src/routes/divisions/index.tsx` — **system_admin only**, nav entry hidden otherwise, forbidden state for other roles (mirror the Providers gate from Task 18). Columns: name, active, organization count; row action: edit. Toasts on save/failure like the other forms.
  - `/organizations` (system_admin): division select on the create form (required), division column in the table, optional division filter.
  - `features/org-structure`: every "Site" label/file/testid → "Facility" (`get-sites.ts` → `get-facilities.ts`, forms, table headers); department form gets a `facilityType` select; departments table gets a `facilityType` column.
  - `features/user-management` (`get-org-structure.ts`, `user-access-form.tsx`): `facilityId` rename, "Facility" grouping label.
  - Fixtures (`src/testing/fixtures.ts`, seed ids incl. `22222222-…`), MSW handlers, component tests updated. `user-access-form.test.tsx` covers the rename.
- Playwright: `e2e/org-structure.spec.ts` (facility wording, department create/edit with type, `@smoke` on the create path), new `e2e/divisions.spec.ts` (system_admin CRUD, staff/org_admin forbidden), `e2e/user-management.spec.ts` if it asserts site labels. Data via the real API with `E2E-` prefixes as usual.
- Every `site-*` `data-testid` becomes `facility-*`; new `division-*` and `department-facility-type*` ids per the guide's derivation rules. **`docs/admin-ui-guide.md` updated in the same commit** (AGENTS.md §4).

## 4. Part B — `PatientLookup` (one migration: `PatientLookup`)

### 4.1 Table (new, `EntityBase`)

| Field | Type | Notes |
|---|---|---|
| `Id` | uuid PK | |
| `OrganizationId` | uuid FK → Organization, `Restrict` | Must equal `Patient.OrganizationId` — assert in the write path (a mismatch is a bug, not user input). |
| `PatientId` | **int** FK → Patient, `Restrict` | |
| `AssigningAuthority` | string(100), required | Who issued the identifier. UI/backfill default: `org:{OrganizationId}` (lowercase guid). Future enhancement: a facility COID or the PID-3 assigning authority from an EHR feed. |
| `Mrn` | string(50), required | The identifier value. |
| `IsPrimary` | bool | The one shown as `Patient.mrn`. Exactly one non-retired primary per patient — filtered unique index `(PatientId) WHERE IsPrimary = 1 AND RetiredDate IS NULL`. |
| `Source` | string(20), required | `flatfile \| ui` — mirrors `Patient.ImportSource`. |
| `RetiredDate` | datetime, nullable | Set when the identifier stops resolving (patient soft-deleted; future merge / re-issue). |

Indexes:
- **Unique** `(OrganizationId, AssigningAuthority, Mrn)` **filtered `[RetiredDate] IS NULL`** — soft-deleting a patient retires its rows, so an MRN can be re-used by a new row (today's behaviour, Q6).
- `(PatientId)`.

### 4.2 Migration

1. Create `PatientLookups`.
2. Backfill one row per `Patient`: `Id = NEWID()` (acceptable for backfill), `OrganizationId`, `PatientId`, `AssigningAuthority = 'org:' + LOWER(CONVERT(varchar(36), OrganizationId))`, `Mrn`, `IsPrimary = 1`, `Source = ImportSource`, `RetiredDate = CASE WHEN IsActive = 1 THEN NULL ELSE SYSUTCDATETIME() END`.
3. Drop the `Patients (OrganizationId, Mrn)` filtered index, then drop `Patients.Mrn`, `Patients.ImportBatchId` (import tables shelved), `Patients.InCerner` (Cerner not MVP) and `Patients.IsUsingMobileApp` (mobile app not MVP).
4. `Down` reverses it (re-add the four columns, copy the primary MRN back, re-create the index, drop the table). Keep `Down` honest — it is the rollback path.

Run against a Local database that already has active **and** soft-deleted patients; paste the before/after `SELECT`s in the report.

### 4.3 Server

- `Patient` entity: remove `Mrn`, `ImportBatchId`, `InCerner`, `IsUsingMobileApp`; add `ICollection<PatientLookup> Identifiers`. Delete `Data/DbModels/Imports/` (never registered). `ImportSource`/`Source` allowed values: `flatfile | ui`.
- New `Models/Patients/PatientIdentifierService` (or similar) — the **only** code that writes `PatientLookup` rows. `PatientsController` goes through it (a future import path would too). Methods: `FindActiveAsync(orgId, authority, mrn)`, `CreatePrimary(patient, mrn, source)`, `UpdatePrimaryMrn(patient, mrn)`, `RetireAll(patient)`.
- `PatientsController`:

| Operation | Behaviour |
|---|---|
| List | Project `Mrn` from the primary non-retired row. `search` matches first/last name **or any non-retired identifier** (an old/alias MRN finds the patient — a real improvement). `sortBy=mrn` sorts on the primary. Paging/sort semantics otherwise unchanged. |
| Get by id | `Mrn` from the primary row. |
| Create | Duplicate check via the service (org + default authority + MRN, non-retired) ⇒ 409, same message as today. Insert patient + primary row in one `SaveChanges`. |
| Update `Mrn` | A **correction** (typo): duplicate check, then update the primary row's `Mrn` in place. No retire/alias — aliasing arrives with import/merge tooling. |
| Soft delete | `IsActive = false` + `RetiredDate = UtcNow` on all non-retired rows, one `SaveChanges`. |

- DTO: `mrn` unchanged; **`inCerner` and `hasApp` removed** from the response and from `Patient` in `packages/shared/src/types.ts` + `src/testing/fixtures.ts`. `NotificationChannel` becomes `"sms"` only. No identifiers endpoint yet (`GET /api/patients/{id}/identifiers` comes with the first second-source integration).
- `NotificationsController`: channel selection removed — every attempt is `Channel = "sms"`, `MobileNumber` always set; the TCPA gate and audit row are unchanged. Delete `IPushSender` + `LoggingStubPushSender` and their DI registration. `MessageOut` entity untouched.

### 4.4 Contract, client, tests

- `packages/shared`: `Patient.inCerner` and `Patient.hasApp` removed; `NotificationChannel = "sms"`. `packages/api-client`: no change. `apps/sona.client`: fixtures, and **one user-visible change** — the patients list hint at `src/routes/patients/index.tsx` ("App user — will receive push" / "No app — will receive SMS") is removed (every patient receives SMS, the hint carries no information). Update `docs/admin-ui-guide.md` for that region in the same commit; the notification-history Channel column stays (always SMS).
- Playwright `patients` spec: remove any assertion on the app/SMS hint; otherwise unchanged. Add, if missing: (a) re-create the same MRN after soft delete succeeds; (b) search by MRN still finds the patient; (c) edit MRN then search by the new value. Tag (a) `@smoke`.
- Vitest: nothing new (server-only).

## 4b. Part C — `AuditLogs` + drop `CreateDate`/`ModDate` (one migration: `AuditLogsReplaceTimestamps`)

### 4b.1 Table (new)

| Field | Type | Notes |
|---|---|---|
| `Id` | uuid PK | |
| `TableName` | string(200), required | EF entity/table name. |
| `RecordId` | string(100), required | String because keys are mixed (`int` on Patients/AppUsers, uuid elsewhere). |
| `Action` | string(20), required | `create \| update \| delete` (soft deletes log as `delete`). |
| `ChangedByUserId` | int FK → AppUser, nullable | Null for system/seed/migration writes. `Restrict`. |
| `ChangedAt` | datetime2, required | UTC. |
| `Changes` | nvarchar(max) | What changed. **Shape is a placeholder** — match the column layout of the team's other apps before implementing (§7 Q11). |

Index `(TableName, RecordId)`. No FK on `RecordId` (polymorphic). Rows are never updated or deleted.

### 4b.2 Migration

1. Create `AuditLogs`.
2. Drop `CreateDate`/`ModDate` from `Organizations`, `Facilities`, `Departments`, `UserDepartmentAccesses`, `Providers`, `MessageTemplates`, `MessagesOut`, `Divisions` and `PatientLookups` if they were created with them, and `InDate`/`ModDate` from `AppUsers`. **Exception:** `MessagesOut.CreateDate` is the *attempt* timestamp (consent-blocked attempts have no `SentDateTime`) — **rename it to `AttemptedDateTime`**, do not drop it.
3. No backfill of `AuditLogs` from the dropped columns — history before this migration is simply not available. Say so in `data-model.md`.

### 4b.3 Server

- `EntityBase` → uuid v7 `Id` only. `IAuditStamped`, `StampEntityBaseTimestamps` removed.
- `ApplicationDbContext.SaveChanges`/`SaveChangesAsync` override writes one `AuditLogs` row per Added / Modified / (soft-)Deleted entry, resolving `ChangedByUserId` from `ICurrentUserService` (null when unavailable). `AuditLogs` and `AppLogs` themselves are excluded. **PHI rule:** `Changes` must not carry `MobileNumber`, `Dob`, names, or `MessageOut.Body` — log column names + a redaction marker for those, or hash them; decide with the team's existing pattern.
- `AppUser.LastLogin` stays (business field, not an audit timestamp).
- Contract: any DTO exposing `createDate`/`modDate`/`inDate` drops it. Check `CurrentUserDto` and the organization/provider DTOs. Client: `pnpm typecheck` finds the consumers; fixtures updated.

### 4b.4 Tests

- Vitest: schema tests only if a shared type changed.
- Playwright: existing suites unchanged. Add one Local-only check (via the API, not UI) that creating and editing a patient produces two `AuditLogs` rows with the right `Action` — a `GET /api/local/audit-logs?table=Patients&recordId=` endpoint in `LocalDevController` (404 outside Local) keeps it honest.

## 5. Target schema (after all parts)

What the database looks like once Parts A, B and C have shipped. Attributes shown for every table that exists today or is created by this task; planned tables are boxes only. No table carries `CreateDate`/`ModDate`. Machine-readable version: [`19-sona-schema-v2.dbml`](19-sona-schema-v2.dbml) (paste into dbdiagram.io). This block replaces the diagram in `docs/data-model.md` § Relationships overview when the last part merges.

```mermaid
erDiagram
    Division {
        uuid Id PK
        string Name UK
        bool IsActive
    }
    Organization {
        uuid Id PK
        uuid DivisionId FK
        string Name
        bool IsActive
    }
    Facility {
        uuid Id PK
        uuid OrganizationId FK
        string Name
        bool IsActive
    }
    Department {
        uuid Id PK
        uuid FacilityId FK
        string Name
        string FacilityType "inpatient | outpatient"
        bool IsActive
    }
    AppUser {
        int Id PK
        uuid OrganizationId FK "null for system_admin / unassigned"
        string HCAID
        string Email
        string DisplayName
        string Role "system_admin | org_admin | staff | unassigned"
        datetime LastLogin
    }
    UserDepartmentAccess {
        uuid Id PK
        int AppUserId FK
        uuid DepartmentId FK
    }
    Provider {
        uuid Id PK
        uuid OrganizationId FK
        int AppUserId FK "nullable"
        string FirstName
        string LastName
        string Credentials
        string Npi UK "filtered, nullable"
        string Specialty
        bool IsActive
    }
    Patient {
        int Id PK
        uuid OrganizationId FK
        uuid PrimaryProviderId FK "nullable"
        string FirstName
        string LastName
        date Dob
        string MobileNumber "E.164"
        bool SmsConsent "TCPA gate"
        datetime SmsConsentDate
        string ImportSource "flatfile | ui"
        bool IsActive "soft delete"
    }
    PatientLookup {
        uuid Id PK
        uuid OrganizationId FK
        int PatientId FK
        string AssigningAuthority "who issued it; default org:OrganizationId"
        string Mrn
        bool IsPrimary "one per patient; shown as Patient.mrn"
        string Source "flatfile | ui"
        datetime RetiredDate "nullable; unique (Org, Authority, Mrn) while null"
    }
    MessageTemplate {
        uuid Id PK
        string Key UK
        string Body "approved text, no PHI"
        bool IsActive
    }
    MessageOut {
        uuid Id PK
        int PatientId FK
        int SentByUserId FK
        uuid MessageTemplateId FK "nullable"
        uuid DepartmentId FK "nullable, id only"
        string Channel "sms (push reserved)"
        string Body "rendered snapshot"
        string MobileNumber "number dialed"
        string Status "pending | sent | delivered | failed"
        string ProviderMessageSid
        string FailureReason
        datetime AttemptedDateTime "was CreateDate"
        datetime SentDateTime
        datetime DeliveredDateTime
    }
    AuditLogs {
        uuid Id PK
        string TableName
        string RecordId
        string Action "create | update | delete"
        int ChangedByUserId FK
        datetime ChangedAt
        string Changes "shape TBD - match other apps"
    }
    AppLog {
        int Id PK
        string Level
        string Message
        string Exception
        string Properties
        datetime TimeStamp
    }
    MessageIn {
        uuid Id PK "planned, Enh 1"
    }
    Encounter {
        uuid Id PK "future, Cerner - not MVP (FIN lives here)"
    }
    Device {
        uuid Id PK "shelved - mobile app not MVP"
    }

    Division ||--o{ Organization : owns
    Organization ||--o{ Facility : has
    Facility ||--o{ Department : has
    Organization ||--o{ AppUser : employs
    Organization ||--o{ Provider : "directory of"
    Organization ||--o{ Patient : owns
    Organization ||--o{ PatientLookup : scopes
    Patient ||--|{ PatientLookup : "identified by"
    Provider o|--o{ Patient : "primary for"
    AppUser o|--o| Provider : "login for"
    AppUser ||--o{ UserDepartmentAccess : granted
    Department ||--o{ UserDepartmentAccess : scopes
    Department o|--o{ MessageOut : "sent from"
    AppUser ||--o{ MessageOut : sends
    Patient ||--o{ MessageOut : receives
    MessageTemplate ||--o{ MessageOut : "content of"
    AppUser o|--o{ AuditLogs : "changed by"

    Patient ||--o{ MessageIn : "matched to"
    MessageOut ||--o{ MessageIn : "replied by"
    Patient ||--o{ Encounter : has
    Patient ||--o{ Device : registers
```

## 6. Docs (same PR as the code they describe)

- `docs/data-model.md`: new `Division` section; `Organization` (drop `Type`, add `DivisionId`); `Site` → `Facility`; `Department.FacilityType`; new `PatientLookup` section; `Patient` table loses the `Mrn` and `ImportBatchId` rows; new `AuditLogs` section and the conventions paragraph rewritten (no timestamps on tables); `ImportBatch`/`ImportRowError` section replaced by a one-paragraph "shelved" note; mermaid diagram; § Multi-practice patients gains a sentence on assigning authority.
- `docs/admin-ui-guide.md`: `/divisions` page, organizations page changes, org structure page (Facility wording, ids, FacilityType select/column) — verified in a running Local app.
- `docs/tasks/_context.md`: a "Task 19 shipped" bullet in the implementation-state list; correct the Task 08 bullet's `Sites` reference.
- `docs/getting-started.md`: seed ids (default division).
- `docs/patient-tasks.md`: tick the Task 19 entry.

## 7. Resolved questions (2026-09-02)

| # | Question | Answer |
|---|---|---|
| Q1 | MRN scope | Per organization. |
| Q2 | `FacilityType` purpose | Label / future filtering only. No gating. |
| Q3 | Column name | Keep `FacilityType`. |
| Q4 | `Division.Code` | No. |
| Q5 | `Facility.Coid` | No. |
| Q6/Q7 | Patient history / `CreateDate` | `AuditLogs` (Part C) covers create / edit / delete for every entity. **No table carries `CreateDate`/`ModDate`**, existing ones lose theirs. |
| Q11 | Import tables | Shelved 2026-09-02. Design kept as a note in the DBML file. `MessageIn` stays as planned; `Encounter` stays as a future-enhancement box (Cerner not MVP); `Device` is shelved with the mobile app. |
| Q12 | `AuditLogs` column shape | **Open** — team to share the schema from their other apps before Part C starts. Placeholder in §4b.1. |
| Q8 | Division UI | Full admin page, system_admin. |
| Q9 | External consumers of `Organization.Type` | None. |
| Q10 | `PatientLookup` | **Build it (Part B).** Coworker's driver is multiple MRN sources per patient, which the team expects. `Patient.Mrn` moves into it — single source of truth. |

## 8. Out of scope

- **Anything Cerner** (feeds, `Encounter`, FIN, identifier types) — future enhancement, not MVP (2026-09-02).
- **Patient mobile app** (`Device`, push dispatch, `IsUsingMobileApp`) — shelved, not MVP (2026-09-02). `apps/mobile` stays in the repo untouched; it just has no server support.
- Identifiers read endpoint, merge/alias tooling, duplicate-person detection (Dob + phone) — with the first second-source integration.
- Flat-file import and its tables (shelved).
- `division_admin` role, `AppUser.DivisionId`.
- Gating notifications on `FacilityType`.
- EF global query filters for tenant scoping (`HasQueryFilter`) — worth its own task; noted 2026-09-02.
- Consent history / STOP handling (FCC/TCPA follow-up).

## 9. Definition of Done

Per `_context.md` §Definition of Done, plus:
- Each migration applied to a fresh Local database from `database update` alone **and** on top of a database that already has an org/facility/department/active patient/soft-deleted patient — confirm every row survives, backfills produce the expected values, and `Down` restores `Patients.Mrn`; paste the `SELECT`s in the report.
- Report includes the migration operations list (Part A: proving rename, not drop+create; Part B: backfill row count = patient count; Part C: `MessagesOut.CreateDate` renamed, not dropped).
- `pnpm typecheck && pnpm build && pnpm test && pnpm e2e` green; `dotnet build Sona.slnx` green.
- Divisions page and org structure changes exercised in a running Local app per the guide's playbook; report quotes what was observed.
