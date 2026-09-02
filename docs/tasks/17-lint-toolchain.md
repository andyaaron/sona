# Task 17 — Make `pnpm lint` pass (mobile `expo lint` is broken, packages have no lint)

**Prerequisites:** Read `docs/tasks/_context.md` and `AGENTS.md` §2/§5 (pnpm 11 rules: overrides and build allow-lists live in `pnpm-workspace.yaml`; mobile deps go through `npx expo install`). Found 2026-09-02.

## Problem

`AGENTS.md` §2 lists `pnpm lint` as a verification command, but it has never passed on `main`:

- `apps/mobile` script is `expo lint`, yet neither `eslint` nor `eslint-config-expo` is declared and there is no `eslint.config.js`. `expo lint` then **auto-installs** them on the spot: it edits `apps/mobile/package.json` (`"eslint": "^9.39.5"`, `"eslint-config-expo": "~57.0.2"`), rewrites `pnpm-lock.yaml`, appends `allowBuilds: unrs-resolver: set this to true or false` to `pnpm-workspace.yaml`, and still exits 1 with `ERR_PNPM_IGNORED_BUILDS: unrs-resolver`. A verification command must never mutate the tree.
- `apps/sona.client` (`oxlint`) works and reports only `react(only-export-components)` warnings.
- `packages/shared` and `packages/api-client` have no `lint` script, so turbo silently skips them.

## Requirements

1. **Mobile:** add `eslint` + `eslint-config-expo` deliberately (`cd apps/mobile && npx expo install eslint eslint-config-expo` — matches the SDK 57 pin) and commit a flat `apps/mobile/eslint.config.js` (`const { defineConfig } = require('eslint/config'); const expoConfig = require('eslint-config-expo/flat'); module.exports = defineConfig([expoConfig, { ignores: ['dist/*'] }]);` per the Expo SDK 57 docs — verify against https://docs.expo.dev/versions/v57.0.0/, not memory). Allow the `unrs-resolver` postinstall in `pnpm-workspace.yaml` (`onlyBuiltDependencies` / the pnpm 11 equivalent — check `pnpm --version` docs, not the auto-generated `allowBuilds` placeholder). `expo lint` must run offline without touching `package.json` or the lockfile.
2. **Packages:** add `"lint": "oxlint"` to `packages/shared` and `packages/api-client` (oxlint is already a client devDependency; hoist it to the root or add per package — pick one and say why). Fix or explicitly allow whatever they report.
3. **Client warnings:** either move the non-component exports out of `routes/organization/index.tsx`, `routes/providers/manage.tsx`, `main.tsx` (TanStack Router's `Route` export is expected — configure `react/only-export-components` with `allowExportNames: ['Route']` in `.oxlintrc.json`) or document why the warning is accepted. Zero errors, and warnings must not hide real ones.
4. **Turbo:** confirm `turbo.json` `lint` task has `dependsOn: ["^build"]` only if a package lints against built types; otherwise leave as is. `pnpm lint` from the root must exit 0.
5. Docs: `AGENTS.md` §2 keeps `pnpm lint`; add a one-line note in `docs/getting-started.md` § Verify if any first-run step (approve-builds) is needed. Task 12's CI workflow should run it.

## Verification

- Fresh clone (or `git clean -fdx node_modules` + `pnpm install`) → `pnpm lint` exits 0 and `git status` is clean afterwards.
- `pnpm --filter mobile lint`, `pnpm --filter sona.client lint`, `pnpm --filter @sona/shared lint`, `pnpm --filter @sona/api-client lint` each exit 0.
- `pnpm typecheck` + `pnpm build` unaffected; Metro still bundles (`cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-smoke`) since a mobile dependency changed.

## Out of scope

Server (`dotnet format`) linting, Prettier, pre-commit hooks.

## Definition of Done

Per `_context.md`; tick in `docs/patient-tasks.md`; delete this prompt.
