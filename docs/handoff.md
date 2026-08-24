# Sona — Project Handoff

**Date:** 2026-08-20
**Repo:** HCANCDV/sona

---

## What is Sona?

A nurse/provider-to-patient communication platform for healthcare settings. Providers use a **web admin** to ping patients ("you're ready to be seen"); patients receive a **push notification** (if they have the mobile app) or an **SMS** (if they don't). All notification content is generic — **no PHI ever leaves the database in a message** (HIPAA compliance baked in from day one).

---

## Architecture at a Glance

```
Web Admin (React 19 / Vite 8 / TanStack Router)
        ↓ HTTPS/JSON
ASP.NET Core API (.NET 10 / EF Core / SQL Server)
        ↓
  ┌─────┴─────┐
  Push        SMS
  (Expo)    (Twilio)
        ↓
  Patient's device
```

**Monorepo** (pnpm 11 workspaces + Turborepo) with two shared TS packages consumed as raw source:

| Package | Purpose |
|---|---|
| `@sona/shared` | Domain types (`Patient`, `MessageOut`, `User`) + zod v4 schemas — the single source of truth for the API contract on the TS side |
| `@sona/api-client` | Typed fetch wrapper (`apiFetch`) + endpoint functions (`patientsApi`, `notificationsApi`) |

---

## Repo Structure

```
├── apps/
│   ├── sona.client/     # Web admin — React 19, Vite 8, TanStack Router, Tailwind v4
│   ├── mobile/          # Patient app — Expo SDK 57, Expo Router, NativeWind v5
│   └── sona.server/     # Backend — ASP.NET Core (.NET 10), EF Core, SQL Server
├── packages/
│   ├── shared/          # Domain types + zod schemas
│   └── api-client/      # Typed fetch client
└── docs/                # Living documentation (architecture, data model, compliance, tasks)
```

Both frontends follow **bulletproof-react**: `app/ → features/ → (components/, hooks/, lib/)`. Features never import from other features.

---

## Tech Stack Summary

| Layer | Tech | Version |
|---|---|---|
| Monorepo | pnpm + Turborepo | pnpm 11 |
| Web admin | React + Vite + TanStack Router | React 19.2 / Vite 8 |
| Mobile | Expo (React Native) | SDK 57 / RN 0.86 |
| Server state | TanStack Query | v5 |
| Forms | TanStack Form + zod | v1 + zod v4 |
| Styling (web) | Tailwind CSS v4 | `@tailwindcss/vite` plugin |
| Styling (mobile) | NativeWind v5 (preview) | pinned `lightningcss@1.30.1` |
| Validation | zod v4 | schemas in `@sona/shared` |
| Backend | ASP.NET Core + EF Core | .NET 10 |
| Database | SQL Server | via EF Core migrations |
| TypeScript | 6.0 strict | `erasableSyntaxOnly` on (no enums, no namespaces, no param properties) |

---

## What's Been Built

### Backend (apps/sona.server)

- **EF Core data layer** fully set up — `ApplicationDbContext`, `EntityBase` (UUID PKs via `Guid.CreateVersion7()`, auto-stamped `CreateDate`/`ModDate`), SQL Server provider
- **6 MVP database tables** implemented with migrations:
  - `Patients` — demographics, MRN (unique), SMS consent, import source, soft delete
  - `AppUsers` — staff accounts (nurse/provider/admin roles), no auth columns yet
  - `MessagesOut` — outbound notification audit log (push/sms channel, status tracking, Twilio SID)
  - `MessageTemplates` — approved message texts (seeded: "You're ready to be seen")
  - `ImportBatches` / `ImportRowErrors` — flat-file import audit trail
- **Controllers:**
  - `PatientsController` — full CRUD (list, get, create with duplicate MRN check, update, soft delete)
  - `UserController` — user retrieval
  - `AuthController` — OIDC callback flow (groundwork)
- **Migrations:** `InitialCreate` → `serilog` → `UniqueMrnIndex`
- **Serilog** configured for structured logging
- **Auth:** OIDC setup started, not complete — auth provider TBD

### Web Admin (apps/sona.client)

- **Features implemented:**
  - `patients/` — full patient management
    - `api/`: `get-patients.ts`, `create-patient.ts`, `update-patient.ts`, `delete-patient.ts` (TanStack Query patterns)
    - `components/`: `patient-form.tsx` (TanStack Form + zod validation from `@sona/shared`)
  - `notifications/` — notify patient
    - `api/`: `notify-patient.ts` (mutation hook)
    - `components/`: `notify-patient-button.tsx`
  - `user/` — current user
    - `api/`: `getUser.ts`
- **Routes:** file-based via TanStack Router plugin (routes in `src/app/routes/`)
- **UI:** Tailwind v4, shared Button component, search/filter on patient list, toast notifications
- **Env config:** centralized in `src/config/env.ts`

### Mobile App (apps/mobile)

- **Scaffolded** with Expo SDK 57 + NativeWind v5
- **No features implemented yet** — no `src/features/` code exists
- Expo Router configured for file-based routing in `src/app/`

### Shared Packages

- **`@sona/shared`** — complete domain types:
  - `Patient`, `User`, `AccessLevel`, `UserRole`, `MessageOut`, `NotificationChannel`, `NotificationStatus`, `PatientImportSource`
  - Schemas: `createPatientSchema`, `updatePatientSchema`, `notifyPatientSchema`
- **`@sona/api-client`** — typed endpoints:
  - `patientsApi`: list, get, create, update, delete
  - `notificationsApi`: notifyReady, listForPatient

---

## Current Task List

### High Priority (patient-tasks.md)
- [x] Search & filter patients
- [x] Duplicate MRN validation
- [ ] **SMS consent date stamping** — auto-set `smsConsentDate` server-side when consent flips
- [x] Convert patient form to TanStack Form
- [ ] **Provider-to-patient assignment** — new `ProviderPatient` join table (many-to-many), API endpoints for assign/unassign, admin UI for managing assignments. Design notes in `docs/patient-tasks.md`.

### Medium Priority
- [ ] **Bulk patient import** — CSV upload using `flatfile` import source
- [ ] **Notification history per patient** — UI for past notifications (API endpoint exists)
- [ ] **Confirmation before notifying** — prevent accidental pings

### Lower Priority
- [ ] **Pagination** — patient list performance
- [ ] **Sortable columns** — patient list UX

### MVP Database Tasks (docs/tasks/mvp-database.md)
- [x] All 7 tasks completed (2026-08-11): EF Core foundation, MessageTemplate + seed, AppUser table, Patient table, MessageOut table, ImportBatch/ImportRowError tables, final verification

---

## What's NOT Done Yet (Major Gaps)

| Area | Status | Notes |
|---|---|---|
| **Authentication** | Stubbed | OIDC groundwork exists; auth provider undecided. Token retrieval stubbed in both apps' `lib/api-client.ts`. No password/credential columns on AppUser. |
| **Authorization / RBAC** | Not started | Compliance requires server-side role checks on every endpoint |
| **SMS sending (Twilio)** | Not started | Vendor must sign a BAA; `notifyReady` endpoint exists in api-client but no send pipeline |
| **Push notifications** | Not started | Expo Push Service integration; `Device` table designed but not implemented |
| **Mobile app features** | Not started | App is scaffolded only — no patient-facing features |
| **Cerner integration** | Not started | Enhancement 1; `Encounter` table designed in data-model.md |
| **SMS reply-back** | Not started | Enhancement 1; `MessageIn` table designed in data-model.md |
| **Provider-patient assignment** | Designed | Join table approach documented, not implemented |
| **Bulk import** | Not started | DB tables exist (`ImportBatch`/`ImportRowError`), no upload/processing logic |

---

## Key Compliance Rules

1. **No PHI in notifications, logs, or URLs** — SMS/push content is always generic
2. **Audit every send** — every notification writes a `MessagesOut` row first (no fire-and-forget)
3. **SMS vendor must have a BAA** (Twilio qualifies)
4. **Server-side auth/role checks** — never client-only
5. **Patient data scoped** — mobile app shows only current patient's data

See `docs/compliance.md` for the full checklist.

---

## How to Run

```bash
# Prerequisites: Node.js 22+, pnpm 11 (corepack), .NET 10 SDK, SQL Server (local or Docker)

pnpm install                              # JS dependencies
dotnet tool restore                       # EF Core CLI (local tool)
dotnet build apps/sona.server/sona.server.csproj

# Start dev servers
pnpm dev:admin                            # Web admin → https://localhost:5173
dotnet run --project apps/sona.server     # API → http://localhost:5032
pnpm dev:mobile                           # Expo dev server

# Verify
pnpm typecheck                            # All 4 TS packages
pnpm build                                # Production builds
```

See `docs/getting-started.md` for full setup including local SQL Server (Docker one-liner) and migrations.

---

## Important Gotchas

1. **`routeTree.gen.ts`** is generated — never hand-edit. Run `pnpm dev:admin` or `pnpm build` to regenerate.
2. **Route files** go in `src/app/routes/` (not `src/routes/`).
3. **`.npmrc`** has `node-linker=hoisted` — Expo breaks without it. Don't change.
4. **`lightningcss@1.30.1`** override in `pnpm-workspace.yaml` is a NativeWind requirement. Don't change.
5. **Solution file** is `Sona.slnx` (XML format, .NET 10), not `Sona.sln`.
6. **zod v4** — API differs from v3 in some areas.
7. **TS 6.0 `erasableSyntaxOnly`** — no `enum`, no `namespace`, no constructor parameter properties.
8. **pnpm 11** — overrides go in `pnpm-workspace.yaml`, not `package.json`.

---

## Key Files Reference

| What | Where |
|---|---|
| Domain types + schemas | `packages/shared/src/types.ts`, `schemas.ts` |
| API client endpoints | `packages/api-client/src/endpoints.ts` |
| Admin routes | `apps/sona.client/src/app/routes/` |
| Admin features | `apps/sona.client/src/features/{patients,notifications,user}/` |
| Backend controllers | `apps/sona.server/Controllers/` |
| EF Core entities | `apps/sona.server/Data/DbModels/` |
| DB context | `apps/sona.server/Data/ApplicationDbContext.cs` |
| Migrations | `apps/sona.server/Data/Migrations/` |
| Data model design | `docs/data-model.md` |
| Task lists | `docs/patient-tasks.md`, `docs/tasks/mvp-database.md` |
| Agent instructions | `AGENTS.md` (root) |
