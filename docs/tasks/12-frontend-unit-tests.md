# Task 12 — Frontend tests for the admin: Vitest unit/component + Playwright E2E

**Prerequisites:** Read `docs/tasks/_context.md` and `AGENTS.md`. Two layers, landed in order: **§1–2 (Vitest)** need nothing else; **§3 (Playwright)** needs Task 13 (Local profile — the only way a browser can sign in outside HCA) and Task 14 (`data-testid` sweep + `docs/admin-ui-guide.md`) for stable selectors and click paths.

## Why (audit of how features are verified today, 2026-09-01)

There are **no automated tests anywhere in the repo**:

- Zero `*.test.*` / `*.spec.*` files in any TS package; no `*.Tests.csproj` in `Sona.slnx`.
- Root `pnpm test` runs `turbo run test`, but no package defines a `test` script — it is a no-op that exits 0.
- CI (`.github/workflows/codeql-analysis.yml`) runs CodeQL only. Nothing runs `pnpm typecheck`, `pnpm build`, or `dotnet build` on push/PR.
- The Definition of Done is therefore **compile-level only**: typecheck + build + `dotnet build`. Behaviour is verified by hand in a browser — and on any machine without Azure credentials the API cannot even start (Key Vault pull in `Program.cs`, Entra login), so agents ship UI features that have never been rendered. Task 11's three bugs are exactly this failure mode: `inviteUserSchema` + the seeded id would have failed a five-line schema test.

## Goal

A test toolchain the Definition of Done can lean on, in two layers that split by *what they can catch*:

| Layer | Tool | Runs against | Catches | Speed / where |
|---|---|---|---|---|
| Unit / component | **Vitest** + Testing Library + **MSW** | Components in jsdom; API mocked at the network boundary | Validation logic, form state, rendering, query/mutation wiring — Task 11's bugs live here | ms; every commit, CI, no server |
| End-to-end | **Playwright** | Real Chromium against the real admin + real API (Task 13 Local profile, local SQL) | Routing, auth bounce, role gating as the server actually enforces it, cross-page flows, "does the user see it" | seconds–minutes; PR CI + before declaring a frontend task done |

Playwright is the layer an agent uses to *prove* a feature works; Vitest is the layer that keeps it working cheaply. Neither replaces the other: Playwright without unit tests is slow and flaky at pinpointing a failing refinement; Vitest without Playwright never exercises the router, the cookie session, or the server's policies (which is exactly how the current gap arose).

## Stack (decided — match existing tooling, don't introduce parallel choices)

| Piece | Choice | Notes |
|---|---|---|
| Runner | **Vitest** | Same Vite config/aliases as the app; `environment: "jsdom"` for the client, `node` for `packages/shared`. Add with `pnpm --filter <pkg> add -D vitest` (see §2 of AGENTS.md for filter names). |
| Component tests | **@testing-library/react** + **@testing-library/user-event** + **@testing-library/jest-dom** | React 19-compatible versions only. |
| API mocking | **MSW** (`msw/node`) | Mock at the network boundary so `@sona/api-client` + TanStack Query run for real. Handlers live in `apps/sona.client/src/testing/handlers/` and return `@sona/shared`-typed fixtures. |
| Fixtures | `apps/sona.client/src/testing/fixtures.ts` | Typed factories (`makePatient()`, `makeUser({ role })`, …). **Use the real seed ids** (`11111111-1111-1111-1111-111111111111` etc.) in org fixtures — they are the values that broke Task 11. |

Keep `pnpm typecheck` covering test files (they import from `@/` and `@sona/shared`; if `tsc -b` chokes on `vitest/globals`, add a `tsconfig.test.json` rather than `any`-ing).

## Requirements

### 1. Toolchain

1. `packages/shared`: `vitest` + `test` script (`vitest run`). No DOM needed.
2. `apps/sona.client`: `vitest`, jsdom, Testing Library, MSW, `test` script; `vitest.config.ts` re-using `vite.config.ts` aliases (`@/`). `src/testing/setup.ts` registers jest-dom matchers and starts/stops the MSW server (`onUnhandledRequest: "error"` — an unmocked call is a test bug).
3. `src/testing/render.tsx`: `renderWithProviders(ui, { user?, route? })` — wraps in a fresh `QueryClient` (`retry: false`), the `UserContext`, and a TanStack Router memory history when a route is under test. Feature components should be testable **without** the router where possible — test components in `features/*/components/`, not route files, unless the route is the composition under test.
4. `turbo.json`: `test` task with `dependsOn: ["^build"]` (shared packages are raw TS, so this is cheap) and cache on `coverage/**`.
5. **CI:** add `.github/workflows/ci.yml` — on push + PR: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `dotnet build Sona.slnx`. This is the first time typecheck/build run anywhere but a developer laptop.
6. `AGENTS.md` §4 Definition of Done + `_context.md` DoD: add "`pnpm test` passes; new/changed frontend behaviour has a test". Getting-started `## Verify` block gets `pnpm test`.

### 2. First unit/component tests — in this order (each is a small, reviewable commit)

1. **`packages/shared/src/schemas.test.ts`** — every zod schema: accepts a valid input, rejects the documented invalid ones, and **accepts SQL Server `uniqueidentifier`-shaped ids including the seed ids** (this is the Task 11 regression test; it must fail before Task 11 lands and pass after). Cover `updateUserSchema`/`inviteUserSchema` refinements (system_admin ⇒ no org; org_admin/staff ⇒ org required; departments only for staff), `notifyPatientSchema`, `createPatientSchema` consent/phone rules.
2. **`features/user-management/components/user-access-form.test.tsx`** — assign + invite modes: role switch clears/restores org and departments; validation messages render on the *visible* field; hidden-field errors never block submit silently (asserts the Task 11 fix); submit payload shape.
3. **`features/patients/components/patient-form.test.tsx`** — required fields, E.164 phone, consent must be explicit, edit mode pre-fill.
4. **`features/notifications/components/notify-patient-button.test.tsx`** — confirm dialog gate, mutation fires `POST /api/notifications/ready` with `patientId` (+ `departmentId` when the store has one), success/error toast paths, TCPA 409 surfaced.
5. **`components/Table/Table.test.tsx`** — client mode sorting/pagination toggles; `manual` mode calls back instead of sorting locally.
6. **`routes/user-management` (route-level, memory history)** — pending queue renders `unassigned` users on top; `unassigned` viewer sees the pending-approval screen; nav gating by role is UX-only (assert links hidden, not that the API is protected).

Target after this task: not a coverage number — **every bug in Task 11 has a test that would have caught it**, and every form/mutation component has at least one happy-path and one validation test.

### 3. Playwright E2E layer

**Setup**
- `pnpm --filter sona.client add -D @playwright/test`; `npx playwright install chromium` (Chromium only — the admin is an internal desktop tool). Tests live in `apps/sona.client/e2e/`, config `apps/sona.client/playwright.config.ts`.
- `webServer` array in the config starts both processes when not already running: the API with `ASPNETCORE_ENVIRONMENT=Local` (`dotnet run --project ../sona.server`, `url: http://localhost:5032/api/user`, `reuseExistingServer: true`) and the admin (`pnpm dev`, `url: https://localhost:5173`, `ignoreHTTPSErrors: true`). Playwright never talks to Azure; that is the whole point of Task 13.
- Auth: none needed — `LocalDevAuth` signs every request in as the configured dev user. To test another **role**, the spec changes `AppUsers.Role` for the dev user through the API (`PUT /api/users/{id}` as system_admin) or a Local-only seed helper, then reloads. Document the helper in `e2e/fixtures/roles.ts`.
- Data: each spec creates what it needs through the real API (`request` fixture → `POST /api/patients`, …) with unique MRNs/names and cleans up (soft-delete) in `afterEach`. The seeded org/site/department (`1111…`/`2222…`/`3333…`) are assumed present. Never rely on rows another spec created.
- Selectors: `getByTestId` from Task 14's registry first; `getByRole` for buttons/dialogs second; never CSS classes or copy text as the primary locator.
- Scripts: `pnpm --filter sona.client e2e` (`playwright test`), `e2e:ui`, `e2e:codegen`. Root `pnpm e2e` via turbo (`cache: false`).
- CI: separate job in `.github/workflows/ci.yml` — `services: mcr.microsoft.com/mssql/server:2022-latest`, `dotnet ef database update` with `ASPNETCORE_ENVIRONMENT=Local` + an `appsettings.Local.json` written from CI env, then `pnpm e2e`. Upload the HTML report + traces on failure. Tag specs `@smoke` for the PR-blocking subset; full suite on `main`.
- Shared fixtures with Vitest: `src/testing/fixtures.ts` factories are reused to build request bodies; MSW handlers are **not** reused (E2E hits the real API). A `@mocked` project that intercepts with `page.route` is allowed for pure-UI states that are hard to reach with real data (server 500, empty org) — keep it small and separate.

**First specs (in order)**
1. `smoke.spec.ts` — app loads, dev user resolved, nav items match role, each route renders its main region testid.
2. `user-management.spec.ts` — pending queue shows an `unassigned` user; assign → row moves; invite flow happy path (directory search is unavailable in Local — assert the documented 503 handling); the three Task 11 repro rows from that task's matrix.
3. `patients.spec.ts` — create (unique MRN) → appears in list → search → edit → notify: consent-missing 409 surfaces; consent true → `MessageOut` row shows `failed`/`sms-not-configured` in history (Webex unconfigured in Local — this *is* the expected outcome).
4. `tenant-scoping.spec.ts` — as org_admin of Default Practice, a patient id created under a second org (system_admin step) returns 404 in the UI; nav hides `/organizations`.
5. `org-structure.spec.ts` — add site → add department → deactivate; sites level hidden while one site.

**Agent usage note:** Playwright is also how an agent verifies its own work interactively — `pnpm --filter sona.client e2e:codegen` records a click path against the running Local app, and the browser tooling in the agent harness can drive the same URLs. Quote what was observed; attach traces/screenshots for UI changes.

## Out of scope

Server tests (xUnit project for the API — separate task; can reuse Task 13's local db), visual regression, cross-browser matrices, mobile app tests.

## Definition of Done

Per `_context.md`, plus: `pnpm test` runs both packages and passes locally and in CI; `pnpm e2e` `@smoke` passes against a Local API in CI and on a machine with no Azure access; `pnpm typecheck` still covers test and e2e files; docs updated (§1.6, `docs/admin-ui-guide.md` playbook links to the scripts); tick in `docs/patient-tasks.md`; delete this prompt on completion.
