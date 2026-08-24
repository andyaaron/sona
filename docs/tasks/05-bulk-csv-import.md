# Task 05 — Bulk patient import via CSV upload

**Prerequisite:** Task 00 (migration baseline fix) merged.
Read `docs/tasks/_context.md`, `AGENTS.md`, and the `ImportBatch`/`ImportRowError` sections of `docs/data-model.md` first.

## Goal

Admin uploads a CSV of patients; server validates row-by-row, creates patients, records an auditable `ImportBatch` with per-row errors, and the UI shows the outcome.

## Requirements

1. **Entities:** Reconcile the existing `Data/DbModels/Imports/ImportBatch.cs` + `ImportRowError.cs` files against `docs/data-model.md` (NEW tables ⇒ Guid PKs via `EntityBase` per `_context.md` — `Patient.ImportBatchId` is already `Guid?` in anticipation; implement the `ApplicationDbContext` timestamp stamping if it's still a TODO stub when you start. `ImportBatch`: FileName, UploadedByUserId **int** FK → AppUser, Status processing|completed|failed, RowsTotal/RowsImported/RowsFailed; `ImportRowError`: ImportBatchId Guid FK, RowNumber, ErrorMessage). Uncomment/add DbSets, wire `Patient.ImportBatchId` as a real nullable FK. One migration.
2. **CSV format** (document it in the endpoint's XML doc + `docs/getting-started.md`): header row required, columns `mrn,firstName,lastName,dob,phoneNumber,smsConsent` — dob `yyyy-MM-dd`, phone E.164, smsConsent `true`/`false`. Reject files > 5 MB or > 5000 rows with 400 before processing.
3. **`POST /api/patients/import`** (multipart/form-data, field `file`):
   - Parse with a small hand-rolled parser or `CsvHelper` (if adding the package, latest stable; nothing exotic).
   - Create the `ImportBatch` (status `processing`) first, process synchronously, finish with `completed` (or `failed` for unreadable file). Per-row validation mirrors `createPatientSchema` rules server-side; consent stamping matches `PatientsController.CreatePatient` (consent true ⇒ `SmsConsentDate = UtcNow`) — extract a shared helper rather than duplicating; `ImportSource = "flatfile"`; stamp `ImportBatchId` on each created patient.
   - Row-level failures (bad phone/dob, missing fields, duplicate MRN vs db **or vs earlier row in the same file**) ⇒ `ImportRowError` row; valid rows still import (partial success is expected).
   - ⚠️ PHI: `ErrorMessage` describes the problem ("invalid phone format") — NEVER echo the raw row/field values, and no PHI in logs.
   - Response: batch summary matching the shared contract (id, status, rowsTotal/Imported/Failed, errors list).
4. **Contract:** `ImportBatch` + `ImportRowError` types in `packages/shared/src/types.ts` (camelCase, string uuid ids, `uploadedByUserId: number`); no zod schema needed for the file itself. `packages/api-client`: `patientsApi.import(file: File)` using FormData (check `client.ts` `apiFetch` — extend it or add a sibling helper if it JSON-encodes bodies unconditionally; don't set Content-Type manually for FormData).
5. **Client UI:** `features/patients/components/import-patients.tsx` — file picker + upload button on the **manage** page (`src/routes/patients/manage.tsx`, the CRUD hub), mutation hook `features/patients/api/import-patients.ts`, invalidate `['patients']` on success, then render the summary (counts + per-row errors table). Reuse `src/components/button.tsx` and existing styling idioms.
6. **Docs:** tick the checkbox in `docs/patient-tasks.md`; note the CSV column spec.

## Out of scope

Async/background processing, Excel formats, upsert/update of existing patients (duplicate MRN = row error, not merge), Cerner ingest, download-errors-as-file.

## Definition of Done

Per `_context.md`. In your report include a table of the row-failure cases you handle and where each is covered in code. If a local runnable db is unavailable, say verification was build+typecheck+walkthrough.
