# Task 02 — Provider table + provider-to-patient assignment

**Prerequisite:** Task 00 (migration baseline fix) merged.
Read `docs/tasks/_context.md`, `AGENTS.md`, and the **"Design Notes: Provider–Patient Assignment (audited 2026-08-20)"** section of `docs/patient-tasks.md` — that section IS the design spec; this prompt only operationalizes it. Where the design notes and `_context.md` disagree on PK details, `_context.md` (post-merge reality) wins: `Patient.Id` is int (string in the contract), `Provider` is a NEW table so it uses `EntityBase` (Guid v7).

## Goal

New `Provider` directory table; every patient gets a nullable `PrimaryProviderId`; admin can assign a provider to a patient and filter the list by provider.

## Key design facts (from the audited notes — do not re-litigate)

- `Provider` is a **directory entity, separate from `AppUser`** (front desk sends on behalf of providers; some providers never log in). Optional link: `Provider.AppUserId` (int, nullable FK → AppUser).
- Single nullable FK `Patient.PrimaryProviderId` — NOT a many-to-many join table (that's explicitly deferred).
- `Provider` inherits `EntityBase` (Guid v7). Fields: `FirstName`/`LastName` (required), `Credentials` (nullable), `Npi` (nullable, string(10), unique when present), `Specialty` (nullable), `AppUserId` (nullable), `IsActive` (default true). Unique filtered index on `Npi`.
- ⚠️ Compliance: `Specialty` must NEVER appear in any notification payload, log line, or URL.
- Providers are deactivated, never deleted. Deleting a provider with assigned patients must be impossible (`DeleteBehavior.Restrict` on the FK; no DELETE endpoint at all in this task).

## Requirements

1. **Server:** `Provider` entity (`Data/DbModels/Providers/Provider.cs`) inheriting `EntityBase`, `DbSet<Provider>`, `Patient.PrimaryProviderId` (Guid?, FK, Restrict), one EF migration for both. This is the first `EntityBase` entity actually registered — implement the UTC `CreateDate`/`ModDate` stamping in `ApplicationDbContext`'s `SaveChanges`/`SaveChangesAsync` overrides (currently TODO stubs) as part of this task.
2. **Server endpoints** (new `ProvidersController` + extend `PatientsController`):
   - `GET /api/providers` — list, ordered by LastName; optional `?isActive=` filter.
   - `POST /api/providers` — create; validate FirstName/LastName required, Npi shape (10 digits) when present; duplicate Npi ⇒ 409.
   - `PUT /api/providers/{id:guid}` — update incl. `isActive` (deactivation).
   - Extend the existing `PUT /api/patients/{id}` (`UpdatePatientRequest` in `PatientsController`) with nullable `primaryProviderId` following its existing partial-update pattern. Reject assignment to an inactive or nonexistent provider (400/404). Include the provider id (and display name, resolved via join) in `PatientResponseDto`.
   - `GET /api/patients?providerId={guid}` — filter list by assigned provider (the endpoint currently takes no query params; add this one).
3. **Contract (`packages/shared`):** `Provider` interface (string uuid id, camelCase fields incl. `appUserId: number | null`), `createProviderSchema`/`updateProviderSchema` in `schemas.ts`, add `primaryProviderId: string | null` to `Patient` and to `createPatientSchema`/`updatePatientSchema` (optional/nullable). NPI zod rule: `/^\d{10}$/` optional.
4. **API client:** `providersApi` (list/create/update) in `packages/api-client/src/endpoints.ts`; extend `patientsApi.list` to accept optional `{ providerId }` and build the query string.
5. **Client UI** (`apps/sona.client`, bulletproof-react: new `src/features/providers/` — remember features must not import from other features; shared pieces go in `src/components/`):
   - `features/providers/api/get-providers.ts` (queryOptions, mirror `get-patients.ts`).
   - Assignment control: add a provider `<select>` (active providers, plus an "Unassigned" option) to the existing `features/patients/components/patient-form.tsx`, using the existing `SelectField` component in `src/components/Form/` — create and edit flows both get it via the manage page.
   - Patient lists (`routes/patients/index.tsx` and the manage page): show assigned provider name per row ("Unassigned" when null); add a provider filter dropdown wired to `patientsApi.list({ providerId })`.
   - Minimal provider management: a `/providers/manage` route (mirror `routes/patients/manage.tsx` structure) with list + create/edit form (First/Last/Credentials/NPI/Specialty, `isActive` toggle on edit) so the select has data. Reuse the `Form/` field components; add a header nav link like the existing pages.
6. **Docs:** add the Provider table + relationship line to `docs/data-model.md`; tick the checkbox in `docs/patient-tasks.md`.

## Out of scope

Join-table history, "My patients" scoping by logged-in user, `MessageOut.OnBehalfOfProviderId`, provider delete, Cerner sync.

## Definition of Done

Per `_context.md`. Migration file's `Up()` visibly creates `Providers` and alters `Patients`. All four TS packages typecheck; `pnpm build` passes (new route file regenerates `routeTree.gen.ts` during build — never hand-edit it).
