# Shared Task Context — read fully before starting any task in this folder

Every task prompt in `docs/tasks/` assumes you have read this file AND `AGENTS.md` (repo root).

## AGENTS.md corrections (stale after the repo restructure — these override it)

- Web admin is `apps/sona.client` (was `apps/admin`). Backend is `apps/sona.server` (was `apps/api/Sona.Api`), namespace `Sona.Server`.
- The solution file is `Sona.slnx` at the **repo root**. Build with `dotnet build Sona.slnx` (not `apps/api/Sona.slnx`).
- Admin route files live in `apps/sona.client/src/routes/` (TanStack Router plugin default), **not** `src/app/routes/`.
- Root scripts run through turbo but keep the same names: `pnpm typecheck`, `pnpm build`, `pnpm dev:admin`, `pnpm lint`.
- Everything else in AGENTS.md (golden rules, PHI compliance, contract-first in `packages/shared`, bulletproof-react layout, Definition of Done) still applies.

## Current implementation state (verified 2026-08-20 on `main` @ b958983 — trust this over older docs)

- **Server** (`apps/sona.server`): ASP.NET Core + EF Core → Azure SQL dev db (AAD auth in `appsettings.Development.json`). Entities in `Data/DbModels/`: `AppUser` (**int PK**, OIDC/HCAID, `AccessLevelId → AccessLevels` — there is **no Role column**), `Patient` (**int PK**), plus `Messaging/` (`MessageOut`, `MessageTemplate` — registered in Task 03) and not-yet-registered entity files under `Imports/` (`ImportBatch`, `ImportRowError`) whose `DbSet`s are commented out in `Data/ApplicationDbContext.cs`.
- **`PatientsController` is real and complete for CRUD:** EF-backed GET (active-only, ordered LastName/FirstName), GET-by-id, POST (duplicate-MRN ⇒ 409, consent stamping), PUT (partial update, MRN 409, consent transition semantics: first-true stamps, repeat-true keeps original date, revoke clears), DELETE (soft — `IsActive = false`). DTO layer maps entity → contract: **`Id` int exposed as string** (`"1"`), `MobileNumber → phoneNumber`, `IsUsingMobileApp → hasApp`, `Dob` DateOnly → `yyyy-MM-dd`. Follow this controller's style for new controllers.
- ~~Known latent bug: `notifyPatientSchema` `.uuid()`~~ — fixed in Task 03 (2026-08-27): now an int-string regex.
- **PK conventions (decided):** existing `Patient`/`AppUser`/`AccessLevel` stay **int** as shipped. **NEW tables use `EntityBase`** (`Data/EntityBase.cs`: Guid v7 PK + `CreateDate`/`ModDate`) per `docs/data-model.md` conventions — note `Patient.ImportBatchId` is already `Guid?` anticipating this. FKs pointing at Patient/AppUser are `int`; FKs among new tables are `Guid`. The `SaveChanges` overrides in `ApplicationDbContext` are TODO stubs — the first task registering an `EntityBase` entity must implement UTC `CreateDate`/`ModDate` stamping there.
- **Migration baseline: FIXED 2026-08-27 (Task 00, completed and deleted).** All prior migrations were replaced by a single `Data/Migrations/20260827173132_InitialCreate.cs` capturing the full model (incl. `Providers`); a fresh database builds from `database update` alone. `Data/DesignTimeDbContextFactory.cs` lets `dotnet ef` run without Azure credentials. New migrations: pass `--output-dir Data/Migrations`. ⚠️ The Azure dev db still needs a one-time `__EFMigrationsHistory` reconciliation by a human — see `docs/getting-started.md` § "Azure dev db reconciliation".
- **`NotificationsController` shipped (Task 03, 2026-08-27):** `POST /api/notifications/ready` (channel selection, TCPA gate, audited `MessageOut` on every attempt) + `GET /api/patients/{id}/notifications`. `MessagesOut`/`MessageTemplates` registered (int FKs to Patient/AppUser); dispatch behind `ISmsSender`/`IPushSender` logging stubs in `Models/Messaging/` — Task 07 replaces the SMS stub with Webex Connect.
- **Client** (`apps/sona.client`): patients list at `src/routes/patients/index.tsx`; full manage page at `src/routes/patients/manage.tsx` (add/edit/soft-delete, **client-side** search by name/MRN). TanStack Form is set up (`src/hooks/form.tsx` + `form-context.tsx`, field components in `src/components/Form/`); `features/patients/components/patient-form.tsx` is the reference form; `features/patients/api/` has create/update/delete mutation hooks + `get-patients.ts` queryOptions; `features/notifications/api/notify-patient.ts` is the reference mutation. Match these patterns exactly. All tabular data renders through the shared TanStack Table v9 component `src/components/Table/Table.tsx` (+ `Pagination.tsx`) — Task 10, 2026-08-31: pass column defs (typed `AppColumnDef<TData>`, living with the feature/route) plus either the `manual` prop for server-driven sorting/paging (see `features/patients/patient-list-search.ts` → `patientTableManualState`) or client mode with `enableSorting`/`enablePagination` toggles. Do not hand-roll `<table>` markup for data. Notify flow (Task 04, 2026-08-31): the route renders `features/notifications/components/notify-patient-button.tsx`, which owns the mutation and shows a confirmation via the generic `ConfirmDialog` in `src/components/confirm-dialog.tsx` — reuse it for future confirm UIs.
- **Contract** (`packages/shared`): `types.ts` — `User` (number id), `Patient` (string id), `MessageOut`, channel/status unions; `schemas.ts` (zod v4) — `createPatientSchema`, `updatePatientSchema` (partial + id; `smsConsentDate` correctly excluded — server-owned), `notifyPatientSchema`. `packages/api-client/src/endpoints.ts` — `patientsApi` list/get/create/update/delete, `notificationsApi`.
- Sibling task list `docs/tasks/mvp-database.md` predates the merge and conflicts with shipped reality in places (says `SonaDbContext`, UUID PKs everywhere; actual is `ApplicationDbContext`, int PKs on existing tables). Where it conflicts with this file or the code, **the code + this file win** — flag, don't follow it blindly.

## Compliance (non-negotiable, from docs/compliance.md)

- No PHI in notification payloads, log lines, or URLs. Message content is generic and template-gated.
- Every notification-send code path persists a `MessageOut` row (audit) — no fire-and-forget.
- TCPA: never send SMS while `Patient.SmsConsent == false`.

## Definition of Done (every task)

1. `pnpm typecheck` passes from repo root.
2. `pnpm build` passes (client changed).
3. `dotnet build Sona.slnx` passes (server changed).
4. Contract changes: `packages/shared` + `packages/api-client` + all consumers updated in the same task.
5. If schema changed: EF migration added (`dotnet ef migrations add <Name> --project apps/sona.server`). You likely cannot reach the Azure dev db — generating the migration is sufficient; say so in your report and never fake a `database update`.
6. Update `docs/patient-tasks.md` checkbox + `docs/data-model.md` if the schema changed.
7. Report honestly: what was verified by a command vs. what was only code-reviewed.
