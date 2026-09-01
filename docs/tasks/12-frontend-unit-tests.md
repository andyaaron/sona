# Task 12 — Frontend unit tests for the admin (Vitest + Testing Library + MSW)

**Prerequisites:** Read `docs/tasks/_context.md` and `AGENTS.md`. Task 13 (Azure-free local mode) is *not* required for this task — unit tests never touch the API — but is the precondition for any browser-level verification later.

## Why (audit of how features are verified today, 2026-09-01)

There are **no automated tests anywhere in the repo**:

- Zero `*.test.*` / `*.spec.*` files in any TS package; no `*.Tests.csproj` in `Sona.slnx`.
- Root `pnpm test` runs `turbo run test`, but no package defines a `test` script — it is a no-op that exits 0.
- CI (`.github/workflows/codeql-analysis.yml`) runs CodeQL only. Nothing runs `pnpm typecheck`, `pnpm build`, or `dotnet build` on push/PR.
- The Definition of Done is therefore **compile-level only**: typecheck + build + `dotnet build`. Behaviour is verified by hand in a browser — and on any machine without Azure credentials the API cannot even start (Key Vault pull in `Program.cs`, Entra login), so agents ship UI features that have never been rendered. Task 11's three bugs are exactly this failure mode: `inviteUserSchema` + the seeded id would have failed a five-line schema test.

## Goal

A test toolchain the Definition of Done can lean on: fast unit/component tests for `packages/shared` and `apps/sona.client`, wired into `pnpm test` and CI, with the first tests covering the code that has already bitten us.

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

### 2. First tests — in this order (each is a small, reviewable commit)

1. **`packages/shared/src/schemas.test.ts`** — every zod schema: accepts a valid input, rejects the documented invalid ones, and **accepts SQL Server `uniqueidentifier`-shaped ids including the seed ids** (this is the Task 11 regression test; it must fail before Task 11 lands and pass after). Cover `updateUserSchema`/`inviteUserSchema` refinements (system_admin ⇒ no org; org_admin/staff ⇒ org required; departments only for staff), `notifyPatientSchema`, `createPatientSchema` consent/phone rules.
2. **`features/user-management/components/user-access-form.test.tsx`** — assign + invite modes: role switch clears/restores org and departments; validation messages render on the *visible* field; hidden-field errors never block submit silently (asserts the Task 11 fix); submit payload shape.
3. **`features/patients/components/patient-form.test.tsx`** — required fields, E.164 phone, consent must be explicit, edit mode pre-fill.
4. **`features/notifications/components/notify-patient-button.test.tsx`** — confirm dialog gate, mutation fires `POST /api/notifications/ready` with `patientId` (+ `departmentId` when the store has one), success/error toast paths, TCPA 409 surfaced.
5. **`components/Table/Table.test.tsx`** — client mode sorting/pagination toggles; `manual` mode calls back instead of sorting locally.
6. **`routes/user-management` (route-level, memory history)** — pending queue renders `unassigned` users on top; `unassigned` viewer sees the pending-approval screen; nav gating by role is UX-only (assert links hidden, not that the API is protected).

Target after this task: not a coverage number — **every bug in Task 11 has a test that would have caught it**, and every form/mutation component has at least one happy-path and one validation test.

## Out of scope

Server tests (xUnit project for the API — separate task; needs Task 13's local db story), E2E/Playwright, visual regression, mobile app tests.

## Definition of Done

Per `_context.md`, plus: `pnpm test` runs both packages and passes locally and in the new CI workflow; `pnpm typecheck` still covers test files; docs updated (§1.6); tick in `docs/patient-tasks.md`; delete this prompt on completion.
