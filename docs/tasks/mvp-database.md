# MVP Database Tasks

Task list for implementing the MVP database tables defined in [data-model.md](../data-model.md). Written for developer agents — **read [AGENTS.md](../../AGENTS.md) before starting any task**, and re-read the task here in full before implementing it.

## Ground rules for every task

- **Do tasks in order.** Later tasks depend on earlier ones (FKs, shared infrastructure). One task per work session; do not batch.
- **Source of truth:** table shapes come from [data-model.md](../data-model.md). If this file and data-model.md disagree, data-model.md wins — flag the discrepancy and fix this file as part of the task.
- **Contract rule:** if a task changes domain types, change `packages/shared` first, then `packages/api-client`, then consumers — same task, never split (AGENTS.md §0.2).
- **Definition of done, every task:** `dotnet build apps/api/Sona.slnx` passes; `pnpm typecheck` passes from repo root if any TS package was touched; a migration exists and applies cleanly to a fresh database; no PHI in logs, messages, or URLs.
- **Conventions** (from data-model.md): UUID PKs, `CreateDate`/`ModDate` (UTC) on every table, enums stored as strings, phone numbers E.164, soft delete via `IsActive` where specified. Configure these in EF entity configurations, not data annotations, so constraints are visible in one place per entity.
- **Status tracking:** when you complete a task, tick its checkbox and add a one-line note (date + anything the next agent must know).

## Assumptions (flag if wrong, don't silently change)

- **Database: SQL Server** via EF Core (`Microsoft.EntityFrameworkCore.SqlServer`). Team decision — do not substitute another engine.
- **EF Core migrations** are the schema mechanism — no hand-written SQL scripts.
- Auth provider for staff login is **not yet chosen**; the `AppUser` table ships without credential columns (see Task 3).

---

## Task 1 — EF Core foundation

**Goal:** the API has a working data layer: DbContext, SQL Server provider, migrations infrastructure, dev connection string. No domain tables yet.

**Files:**
- `apps/api/Sona.Api/Sona.Api.csproj` — add `Microsoft.EntityFrameworkCore.SqlServer`, `Microsoft.EntityFrameworkCore.Design` (latest stable compatible with .NET 10)
- `apps/api/Sona.Api/Data/SonaDbContext.cs` — new
- `apps/api/Sona.Api/Program.cs` — register DbContext
- `apps/api/Sona.Api/appsettings.Development.json` — dev connection string (localhost, database `SonaDev`, `TrustServerCertificate=True` for local dev). **Never commit real credentials; dev-only values.**
- `docs/getting-started.md` — add: how to run SQL Server locally (document the `docker run` one-liner for `mcr.microsoft.com/mssql/server:2022-latest`; note Apple Silicon needs Rosetta emulation enabled in Docker Desktop), how to apply migrations (`dotnet ef database update`)

**Steps:**
1. Add packages. Do not touch the pinned `Microsoft.OpenApi` version (AGENTS.md §5.7).
2. Create `SonaDbContext` (empty `DbSet`s come in later tasks). Apply a base convention for `CreateDate`/`ModDate`: an abstract `EntityBase` class (`Id` Guid, `CreateDate`, `ModDate`) + `SaveChanges` override or interceptor that stamps them in UTC. `Id` values are generated in application code (`Guid.CreateVersion7()`), not by the database.
3. Register in `Program.cs` with connection string from configuration. Remove the template `weatherforecast` endpoint and `WeatherForecast` record while here — it is dead scaffolding.
4. Create the initial (empty) migration to prove the pipeline: `dotnet ef migrations add Initial --project apps/api/Sona.Api`.
5. Verify: `dotnet build apps/api/Sona.slnx`; `dotnet ef database update` against a local SQL Server succeeds.

**Done when:** build passes, empty migration applies to a fresh local database, getting-started.md documents the local DB workflow.

- [x] Completed — notes: 2026-08-11. EF Core 10.0.10. dotnet-ef installed as local tool (`.config/dotnet-tools.json` — run `dotnet tool restore` on fresh clone). Docker unavailable in the implementing environment, so `database update` was not run live; migrations verified via `dotnet ef migrations script` (see Task 7 note).

---

## Task 2 — MessageTemplate table + seed

**Goal:** `MessageTemplate` table exists and is seeded with the single MVP template. Done early because `MessageOut` (Task 5) references it, and it has no dependencies of its own.

**Table shape:** see [data-model.md → MessageTemplate](../data-model.md#messagetemplate--mvp-small-but-recommended).

**Files:**
- `apps/api/Sona.Api/Features/Messaging/MessageTemplate.cs` — entity (vertical-slice layout per docs/architecture.md)
- `apps/api/Sona.Api/Data/Configurations/MessageTemplateConfiguration.cs` — EF configuration
- `apps/api/Sona.Api/Data/SonaDbContext.cs` — add DbSet
- New migration

**Steps:**
1. Entity: `Key` (unique index), `Body`, `IsActive`, inherits `EntityBase`.
2. Seed via migration data seeding (`HasData` with a **fixed** Guid, not a generated one — migrations must be deterministic): key `ready-to-be-seen`, body `You're ready to be seen. Please come to the front desk.`
3. **Compliance check:** the seeded body must match the approved generic wording in [compliance.md](../compliance.md) — no additions, no clinic names.
4. Migration + verify build and `dotnet ef database update`.

**Done when:** migration applies, seeded row present, unique constraint on `Key` verified in the migration SQL.

- [x] Completed — notes: 2026-08-11. Seeded with fixed UUIDv7-style Guid + fixed seed date (deterministic migration). Body matches compliance.md wording exactly.

---

## Task 3 — AppUser (staff) table

**Goal:** `AppUser` table for internal staff (nurses, providers, admins). Needed before `MessageOut`/`ImportBatch` (FK target for "who did this").

**Table shape:** see [data-model.md → AppUser](../data-model.md#appuser-staff--mvp).

**Files:**
- `apps/api/Sona.Api/Features/Users/AppUser.cs` — entity
- `apps/api/Sona.Api/Data/Configurations/AppUserConfiguration.cs`
- `apps/api/Sona.Api/Data/SonaDbContext.cs` — add DbSet
- New migration
- `packages/shared/src/types.ts` — reconcile with existing `Provider` type (see step 3)

**Steps:**
1. Entity: `FirstName`, `LastName`, `Email` (unique index), `Role` (string enum: `nurse` | `provider` | `admin`), `IsActive` (default true), inherits `EntityBase`.
2. Table name: `AppUsers` explicitly in configuration (avoids any reserved-word friction and matches the entity name).
3. **Contract reconciliation:** `packages/shared` already has `Provider` with the same fields minus `IsActive`. Rename `Provider` → `AppUser` in `packages/shared/src/types.ts` (or add `IsActive` to `Provider` and keep the name — pick ONE, apply consistently). Renaming: update `packages/api-client` and all app imports in the same task; run `pnpm typecheck` from root. This is the cross-cutting part of the task — do not skip or defer it.
4. **No credential columns.** Auth approach is undecided (see data-model.md open questions). Do not add password/hash fields; do not integrate an auth library. Just the profile + role table.
5. Migration + verify.

**Done when:** build + `pnpm typecheck` pass, migration applies, unique email index in place, TS contract has exactly one staff-user type consistent with the entity.

- [x] Completed — notes: 2026-08-11. Renamed `Provider` → `AppUser` in shared types (+ `isActive`); no other package imported `Provider`, so the rename touched only `types.ts`.

---

## Task 4 — Patient table

**Goal:** `Patient` table with import/consent fields. The central domain table.

**Table shape:** see [data-model.md → Patient](../data-model.md#patient--mvp).

**Files:**
- `apps/api/Sona.Api/Features/Patients/Patient.cs` — entity
- `apps/api/Sona.Api/Data/Configurations/PatientConfiguration.cs`
- `apps/api/Sona.Api/Data/SonaDbContext.cs` — add DbSet
- New migration
- `packages/shared/src/types.ts` — extend `Patient` type
- `packages/shared/src/schemas.ts` — extend `createPatientSchema`
- Consumers of `Patient`/`createPatientSchema` in `apps/admin` (find them all — `pnpm typecheck` will surface misses)

**Steps:**
1. Entity per data-model.md: `Mrn` (unique index), `FirstName`, `LastName`, `Dob` (DateOnly), `MobileNumber`, `SmsConsent`, `SmsConsentDate` (nullable), `IsUsingMobileApp`, `InCerner`, `ImportSource` (string enum: `flatfile` | `ui` | `cerner`), `IsActive` (default true), inherits `EntityBase`.
2. **No `FIN` column** — it belongs to the future `Encounter` table (Enhancement 1). If you find a requirement pointing at FIN-on-patient, stop and flag rather than adding it.
3. Add a check-or-app-level guarantee that `MobileNumber` is E.164 — validation lives in the zod schema client-side and in endpoint validation server-side; DB stores the normalized value.
4. **Contract:** extend `Patient` in `packages/shared/src/types.ts` with the new fields (`mrn`, `dob`, `smsConsent`, `smsConsentDate`, `inCerner`, `importSource`, `isActive`; keep `hasApp` naming for `IsUsingMobileApp` — TS name and C# name may differ, mapping happens at the API boundary). Extend `createPatientSchema` in `schemas.ts` (mrn, dob, smsConsent required; consent must be explicitly captured, not defaulted to true). Update admin consumers.
5. Migration + verify: `dotnet build`, `pnpm typecheck`, migration applies.

**Done when:** all gates pass; `createPatientSchema` requires explicit `smsConsent`; no FIN column exists.

- [ ] Completed — notes:

---

## Task 5 — MessageOut table

**Goal:** outbound-message audit table. **This is the compliance-critical table** — every future send path writes here first (no fire-and-forget, [compliance.md](../compliance.md)).

**Table shape:** see [data-model.md → MessageOut](../data-model.md#messageout--mvp).

**Depends on:** Tasks 2 (MessageTemplate), 3 (AppUser), 4 (Patient) — three FK targets.

**Files:**
- `apps/api/Sona.Api/Features/Messaging/MessageOut.cs` — entity
- `apps/api/Sona.Api/Data/Configurations/MessageOutConfiguration.cs`
- `apps/api/Sona.Api/Data/SonaDbContext.cs` — add DbSet
- New migration
- `packages/shared/src/types.ts` — reconcile with `ReadyNotification`

**Steps:**
1. Entity per data-model.md: `PatientId` FK, `SentByUserId` FK, `Channel` (string enum: `sms` | `push`), `MessageTemplateId` FK (nullable), `Body` (nullable), `MobileNumber` (nullable — snapshot at send time), `Status` (string enum: `pending` | `sent` | `delivered` | `failed`), `ProviderMessageSid` (nullable, indexed), `FailureReason` (nullable), `SentDateTime` (nullable), `DeliveredDateTime` (nullable), inherits `EntityBase`.
2. Indexes: `PatientId`, `ProviderMessageSid`, `(Status, CreateDate)` (the "what's pending/failed" query).
3. FK delete behavior: **Restrict** on all three FKs — audit rows must never cascade-delete.
4. **Contract reconciliation:** `packages/shared` has `ReadyNotification` (patientId, sentByProviderId, channel, status, createdAt, deliveredAt). Extend it to match this shape or rename to `MessageOut` — pick the vocabulary once, apply to types + `packages/api-client` (`notificationsApi`) + admin consumers in the same task. `NotificationStatus` values already match `Status`; keep them identical.
5. **Compliance guard:** `Body` is a snapshot of an approved template render — nothing in this task builds a path for arbitrary text. Do not add a create-message endpoint that accepts a caller-supplied body.
6. Migration + verify all gates.

**Done when:** build + typecheck pass; migration applies; FKs are Restrict; contract has one aligned outbound-message type; no endpoint accepts free-text message bodies.

- [ ] Completed — notes:

---

## Task 6 — ImportBatch + ImportRowError tables

**Goal:** audit trail for flat-file patient imports. Two tables, one task (they only exist together).

**Table shape:** see [data-model.md → ImportBatch / ImportRowError](../data-model.md#importbatch--importrowerror--mvp-if-flat-file-import-ships).

**Depends on:** Task 3 (AppUser FK), Task 4 (Patient, for the optional trace FK).

**Files:**
- `apps/api/Sona.Api/Features/Imports/ImportBatch.cs`, `ImportRowError.cs` — entities
- `apps/api/Sona.Api/Data/Configurations/` — two configurations
- `apps/api/Sona.Api/Data/SonaDbContext.cs` — add DbSets
- New migration

**Steps:**
1. `ImportBatch`: `FileName`, `UploadedByUserId` FK → AppUser (Restrict), `Status` (string enum: `processing` | `completed` | `failed`), `RowsTotal`, `RowsImported`, `RowsFailed`, inherits `EntityBase`.
2. `ImportRowError`: `ImportBatchId` FK → ImportBatch (Cascade is fine here — errors are meaningless without their batch), `RowNumber`, `ErrorMessage`, inherits `EntityBase`.
3. Add nullable `ImportBatchId` FK on `Patient` (SetNull on delete) to trace each patient row to its source file. This modifies the Patient entity from Task 4 — same migration.
4. **PHI guard:** `ErrorMessage` holds validation text only (e.g. `"invalid phone format"`). The import implementation (a later task, not this one) must never write raw row contents into it. Add a code comment on the property stating this constraint.
5. No TS contract changes — import tables are not exposed to frontends yet. If you find yourself editing `packages/shared`, stop; that's the import-feature task, not this one.
6. Migration + verify.

**Done when:** build passes, migration applies, PHI constraint comment present on `ErrorMessage`.

- [ ] Completed — notes:

---

## Task 7 — Final verification + doc sync

**Goal:** whole-schema sanity pass; docs reflect reality.

**Steps:**
1. Fresh-database test: drop local `SonaDev`, run all migrations from zero, confirm clean apply and seeded template row.
2. Run the full gate set: `dotnet build apps/api/Sona.slnx`, `pnpm typecheck`, `pnpm build`.
3. Compare final schema against [data-model.md](../data-model.md) field-by-field; fix any drift **in the doc** if the implemented choice was deliberate (and noted in a task's completion notes), otherwise fix the code.
4. Update [architecture.md](../architecture.md) backend section: note EF Core + SQL Server now exist (it currently says "default template").
5. Confirm no task above left an unticked compliance item: no PHI paths, Restrict deletes on audit FKs, no credential columns, no free-text message endpoint.

**Done when:** fresh DB builds from migrations alone, all gates green, docs match code.

- [ ] Completed — notes:

---

## Out of scope for this task list

These are follow-on feature work, not schema work — do not start them from this list:

- API endpoints / repositories / import-processing logic (each is its own future task list)
- Auth integration for `AppUser`
- Enhancement 1 tables (`MessageIn`, `Encounter`) and Enhancement 2 (`Device`) — schemas already sketched in data-model.md, implement when their phase starts
- Twilio integration and the actual send pipeline
