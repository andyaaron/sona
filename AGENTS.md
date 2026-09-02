# AGENTS.md — Sona (Developer Agent Instructions)

You are a developer agent working on **Sona**, a nurse/provider-to-patient communication platform: providers ping patients ("you're ready to be seen") from a web admin; patients receive a push notification if they have the mobile app, otherwise an SMS.

**Read this file before doing any work. Re-read the relevant section before each task.** This file is the contract for how work is done in this repo; the docs under `docs/` are the canonical reference for what is being built.

---

## 0. Golden Rules

1. **Never put PHI in a notification payload, log line, or URL.** SMS and push content must be generic ("You're ready to be seen"). No conditions, appointment reasons, clinic names implying a condition. This is a compliance requirement, not a style preference — see `docs/compliance.md`. If a task seems to require PHI in a message, stop and flag it instead of implementing.
2. **The API contract lives in `packages/shared`.** Domain types and zod schemas there are the single source of truth. Never redefine a `Patient`/`ReadyNotification`/input shape locally in an app — import from `@sona/shared`. Contract changes = change `packages/shared` first, then update consumers in the same task.
3. **Follow bulletproof-react in both frontends.** Dependencies point one way: `app/ → features/ → (components/, hooks/, lib/, utils/)`. Feature code lives in `src/features/<name>/`. **A feature must never import from another feature.** Shared code moves down into `components/`/`lib/`, not sideways.
4. **Server state goes in TanStack Query; never in a store.** Query definitions use the `queryOptions()` helper in `features/*/api/get-*.ts`; mutations are `use*` hooks in `features/*/api/`. Client-only UI state goes in `src/stores/`.
5. **Routing:** TanStack Router on web (`apps/sona.client`), Expo Router on mobile (`apps/mobile`). TanStack Router does not work on React Native — do not try.
6. **Verify after every change.** Minimum bar: `pnpm typecheck` from repo root passes. Do not report a task done with a failing typecheck, build, or test.
7. **Do not touch these without explicit instruction:** `.npmrc` (`node-linker=hoisted` — Expo breaks without it), the `lightningcss` override in `pnpm-workspace.yaml` (NativeWind requirement), `src/app/routeTree.gen.ts` (generated — never hand-edit), `expo-env.d.ts` (generated, committed on purpose).
8. **Small, focused changes.** Implement exactly the task at hand. Do not refactor unrelated code, upgrade dependencies, or restructure folders unless that IS the task.

---

## 1. Repo Map

```
├── apps/
│   ├── sona.client/ # Web admin — React 19 + Vite 8 + TanStack Router + Tailwind v4
│   ├── mobile/      # Patient app — Expo SDK 57 + Expo Router + NativeWind v5
│   └── sona.server/ # Backend — ASP.NET Core (.NET 10)
├── packages/
│   ├── shared/    # Domain types + zod schemas (THE contract)
│   └── api-client/# Typed fetch client: patientsApi, notificationsApi
└── docs/          # architecture.md, tech-stack.md, getting-started.md, compliance.md
```

Both frontends use the same `src/` layout (bulletproof-react):

| Folder | Contents | Rule |
|---|---|---|
| `src/app/` | Routes + providers (router shell) | Routes compose features; no business logic here |
| `src/features/<name>/api/` | Query options + mutation hooks | One file per operation (`get-patients.ts`, `notify-patient.ts`) |
| `src/features/<name>/components/` | Feature-specific components | Not importable from other features |
| `src/components/` | Shared, feature-agnostic UI | No feature imports |
| `src/lib/` | Configured library instances (`query-client.ts`, `api-client.ts`) | |
| `src/config/env.ts` | The ONLY place env vars are read | `import.meta.env.*` (web) / `process.env.EXPO_PUBLIC_*` (mobile) nowhere else |
| `src/stores/` | Client state (Zustand when needed) | Never server data |

Doc map — read as needed, don't guess:
- **What the system does / notification flow** → `docs/architecture.md`
- **Where things are in the admin + how to verify a frontend change** → `docs/admin-ui-guide.md` (route/region map, `data-testid` registry, verification playbook)
- **Why each technology + version constraints** → `docs/tech-stack.md`
- **Compliance rules (PHI, BAA, audit log)** → `docs/compliance.md`
- **Setup / run instructions** → `docs/getting-started.md`
- **Expo specifics** → `apps/mobile/AGENTS.md` (points to versioned Expo SDK 57 docs — Expo APIs changed significantly; verify against those docs, not memory)

---

## 2. Commands

All from repo root unless noted. Working directory matters — check before running.

```bash
# Install / verify environment
pnpm install                             # JS deps (uses pnpm 11 via corepack)
dotnet build apps/sona.server/sona.server.csproj  # restore + build API

# Develop
pnpm dev:admin                           # admin → https://localhost:5173
pnpm dev:mobile                          # Expo dev server
dotnet run --project apps/sona.server    # API → http://localhost:5032

# Verify (run before declaring done)
pnpm typecheck                           # all 4 TS packages — must pass
pnpm build                               # production builds — must pass for admin changes
dotnet build apps/sona.server/sona.server.csproj  # must pass for API changes
pnpm lint
```

**Adding dependencies:**
- Mobile native/Expo packages: `cd apps/mobile && npx expo install <pkg>` — NEVER `pnpm add` for anything with native code; versions must match the SDK.
- Everything else: `pnpm --filter <sona.client|mobile|@sona/shared|@sona/api-client> add <pkg>`.
- Quote workspace specs in zsh: `pnpm --filter sona.client add '@sona/shared@workspace:*'` (unquoted `*` breaks).

---

## 3. Coding Standards

- **TypeScript strict, everywhere.** No `any` unless interfacing with an untyped boundary, and then contain it.
- **TS 6.0 constraints (sona.client especially, `erasableSyntaxOnly` is on):** no constructor parameter properties (`constructor(public x: number)` — write explicit fields), no `enum` (use union types), no `namespace`. No `baseUrl` in tsconfig (deprecated) — `paths` works without it.
- **Imports:** use the `@/` alias for intra-app imports; relative imports only within a feature folder.
- **Validation:** every API input has a zod schema in `packages/shared/src/schemas.ts`. Forms (TanStack Form) validate with these schemas — do not write duplicate inline validation.
- **New API endpoint = three places, same task:** endpoint in `apps/sona.server`, typed function in `packages/api-client/src/endpoints.ts`, types/schemas in `packages/shared`. Do not let these drift.
- **Styling:** Tailwind utility classes. Web uses Tailwind v4 syntax (`@import "tailwindcss"` — NOT the old `@tailwind base/components/utilities` directives). Mobile uses NativeWind `className` props on RN components.
- **Comments explain *why*, not *what*.** Match the existing (sparse) comment density.
- **C# (API):** follow the default template conventions until an API architecture doc exists; keep endpoints thin, plan for vertical-slice organization per `docs/architecture.md`.

---

## 4. Definition of Done (every task)

A task is complete only when ALL of these hold:

- [ ] `pnpm typecheck` passes from repo root (covers all 4 TS packages).
- [ ] If admin changed: `pnpm build` passes.
- [ ] If mobile changed: `pnpm --filter mobile typecheck` passes; for config/native changes also verify Metro bundles: `cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-smoke`.
- [ ] If API changed: `dotnet build apps/sona.server/sona.server.csproj` passes.
- [ ] If the contract changed: `packages/shared` + `packages/api-client` + all consumers updated together.
- [ ] No PHI introduced into notification content, logs, or URLs (rule 0.1).
- [ ] New notification-send code paths persist a `ReadyNotification` record (audit requirement — no fire-and-forget sends).
- [ ] Docs updated if behavior/stack/structure changed (`docs/` is living documentation).
- [ ] **Tests ship with the change (rule since 2026-09-01).** New or changed behaviour comes with tests in the same task: unit/component (Vitest) for logic and validation, Playwright E2E for any user-visible flow — follow the verification playbook at the top of `docs/admin-ui-guide.md`. Until the test toolchain lands (Task 12), state explicitly in the report that no automated test covers the change and what was exercised by hand.
- [ ] Frontend changes were **exercised in a running app** (Local profile, Task 13) following the numbered interactions in `docs/admin-ui-guide.md`, and the report quotes what was observed — typecheck/build alone never satisfies "done" for UI work.
- [ ] **`docs/admin-ui-guide.md` reflects the UI as shipped (rule since 2026-09-01).** Any change a user could notice in the admin — a new page or region, a moved/renamed/removed control (e.g. a button moving from the left of the toolbar to the right), a changed click path, dialog, validation message, toast, empty state, role gate, or `data-testid` — updates the guide **in the same commit**. Select elements by `data-testid` (convention + derivation rules are in the guide); a testid that is not in the guide is a bug. The guide describes *where* things are (page → region → position within the region) as well as *what* they do, so placement changes count. A client change with no guide update must say why in the report ("no user-visible change"). Reviewers: a PR touching `apps/sona.client/src/**` without touching the guide needs that sentence.

---

## 5. Known Gotchas (read before debugging)

These have all bitten before. Check this list before assuming a novel problem:

1. **`routeTree.gen.ts` missing / stale (sona.client):** it's generated by the TanStack Router Vite plugin. Fresh clone → run `pnpm dev:admin` or `pnpm build` once. Typecheck failures referencing it usually mean it hasn't been regenerated after adding a route file.
2. **Route files (sona.client)** live in `src/app/routes/` (configured in `vite.config.ts`, not the default `src/routes/`). New route = new file there; the plugin picks it up on dev/build.
3. **Mobile typecheck fails on CSS imports:** `expo-env.d.ts` must exist (committed). If Expo regenerates types, don't delete it.
4. **NativeWind v5 is a preview release** pinned with `lightningcss@1.30.1` (override in `pnpm-workspace.yaml`). Styling bugs on mobile → check the NativeWind v5 docs first, not v4 docs; v4 advice (babel jsxImportSource, `withNativeWind` input option, tailwind.config.js) mostly does NOT apply.
5. **Env vars are baked at build time** in both frontends (`VITE_*`, `EXPO_PUBLIC_*`). Changing `.env` requires restarting dev server / rebuilding. On a physical device, `localhost` won't reach the API — use the machine's LAN IP.
6. **.NET solution is `Sona.slnx`** (XML format, .NET 10 default) — commands referencing `Sona.sln` fail.
7. **`Microsoft.OpenApi` is pinned** in `sona.server.csproj` to a patched 2.x (template version had a known vulnerability). Don't downgrade.
8. **pnpm 11:** `overrides` live in `pnpm-workspace.yaml`, not `package.json` (the `pnpm` field there is ignored). Supply-chain release-age checks may delay brand-new package versions — exclusions belong in `minimumReleaseAgeExclude`.
9. **zod is v4** — check v4 API when unsure; some v3 patterns changed.
10. **React 19 + RN 0.86 (New Architecture only).** Old-architecture RN libraries won't work; check compatibility before adding any RN dependency.

---

## 6. How to Work (process)

1. **Before starting:** restate the task in one sentence; list the files you expect to touch. If the task is ambiguous about contract shape, compliance, or auth, ask — do not guess on those three. Everything else: pick the simplest option consistent with this file and note the assumption.
2. **Plan → implement → verify, in small steps.** After each meaningful edit, run the narrowest relevant check (`pnpm --filter <pkg> typecheck`), then the full Definition of Done gates at the end.
3. **Read before writing.** Open the files you're changing and at least one neighboring example (e.g., an existing feature's `api/` file) and match its patterns exactly. The existing `features/notifications` and `features/patients` folders are the reference implementations.
4. **When a command fails:** read the error, check §5 Gotchas, fix the cause. Do not retry the identical command hoping for a different result; do not switch tools to bypass a failure you don't understand.
5. **When docs conflict with code:** the code is what runs — but flag the discrepancy and update the doc as part of the task.
6. **Commits:** small and focused; message = what + why. Never commit `.env` files or secrets. Do not commit generated route trees mid-conflict (regenerate instead).

---

## 7. Quick Reference

| Thing | Location / command |
|---|---|
| Domain types + zod schemas | `packages/shared/src/` |
| API client + endpoints | `packages/api-client/src/endpoints.ts` |
| Admin routes | `apps/sona.client/src/app/routes/` |
| Mobile routes | `apps/mobile/src/app/` |
| Query/mutation patterns | `apps/sona.client/src/features/*/api/` (reference impl) |
| Env access | `src/config/env.ts` (each app) |
| API base URL (dev) | `http://localhost:5032` |
| Full verification | `pnpm typecheck && pnpm build && dotnet build apps/sona.server/sona.server.csproj` |
| Compliance rules | `docs/compliance.md` |
| Expo SDK 57 docs | https://docs.expo.dev/versions/v57.0.0/ |

Keep the contract in `packages/shared`, keep PHI out of messages, verify before done.
