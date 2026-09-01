# Task 14 — Admin interface guide + verification playbook (for agents and Playwright)

**Prerequisites:** Read `docs/tasks/_context.md` and `AGENTS.md`. Best done right after Task 13 (Local profile) so every claim in the guide can be checked in a running app; the `data-testid` sweep (§2) should land **before** Task 12's Playwright suite so selectors are stable from the first test.

## Problem

Nothing in the repo tells an agent *where things are* in the admin. To verify "the invite dialog validates the org field" today you must read route files, feature folders, the header, and the API client, then infer the click path. Selectors are ad-hoc (Tailwind classes, button text), so any test written against them breaks on copy or styling changes. Result: features get declared done from typecheck alone (see Task 12's audit).

## Goal

1. A **living document, `docs/admin-ui-guide.md`**, that maps the whole admin: routes, navigation, every page's regions and interactions, role gating, API calls, and the seeded data a fresh Local db provides.
2. A **`data-testid` convention** applied across the admin so tests and agents select by stable ids.
3. A short **verification playbook** — the exact steps an agent runs before declaring a frontend task done.

## Requirements

### 1. `docs/admin-ui-guide.md` — structure (keep it this shape; it is read by agents)

```
## How to run (pointer to getting-started Local profile; ports; dev login user)
## Roles & what each sees (system_admin / org_admin / staff / unassigned) — nav items, blocked routes, pending screen
## Seeded data on a fresh Local db (Default Practice 1111…, Main 2222…, General 3333…, ready-to-be-seen template, dev admin)
## Global chrome — header: logo/home, nav links, org name, department picker (staff w/ >1 dept), user menu
## Pages — one section per route, same sub-headings each time:
   ### /<route>
   - Purpose (one line)
   - Who can see it (role gating: client UX-only vs server policy)
   - Regions (table, filters, dialogs) with their data-testid
   - Interactions — numbered click paths: "1. click [testid] → 2. dialog [testid] opens → 3. …" incl. validation messages and toasts to expect
   - API calls made (method + path, from packages/api-client) and what a 4xx looks like in the UI
   - Empty / loading / error states
## Shared components (Table, Pagination, ConfirmDialog, Form fields) — props that matter for tests, testids they emit
## Known gaps / open bugs (link tasks)
```

Cover every existing route: `/`, `/patients`, `/patients/manage`, `/providers/manage`, `/user-management`, `/organization`, `/organizations`, plus the pending-approval screen and the `/auth/login` bounce. Verify each claim in the running app (Task 13) — do not write it from source alone; mark anything unverified as such.

### 2. `data-testid` convention + sweep

- Kebab-case, `<feature>-<element>[-<qualifier>]`: e.g. `patients-table`, `patients-search-input`, `patient-form-mrn`, `patient-form-submit`, `notify-button`, `confirm-dialog-confirm`, `user-invite-button`, `user-access-form-role`, `user-access-form-organization`, `user-access-form-submit`, `user-access-form-errors`, `users-pending-table`, `org-sites-table`, `header-nav-<route>`, `header-org-name`, `header-department-select`.
- Row-level ids carry the entity id: `patients-row-<id>`, `users-row-<id>`.
- Shared components accept a `testId` prop and derive children (`${testId}-header-<col>`, `${testId}-page-next`, …) — document the derivation rules in the guide.
- Sweep every route/feature component; ids go in the guide as you add them (the guide is the registry — a testid that is not in the guide is a bug).
- Do **not** put PHI or names into ids; entity ids only.

### 3. Verification playbook (section at the top of the guide, and linked from AGENTS.md §4)

Steps an agent runs for any frontend change:
1. `pnpm typecheck && pnpm build && pnpm test` (Vitest unit/component — Task 12).
2. Start Local API + admin (Task 13). Run `pnpm e2e` (Playwright — Task 12 §3) — the tagged smoke suite at minimum.
3. Manually exercise the changed path per the guide's numbered interactions **in the browser** (the agent's browser tool or `playwright codegen`), and quote what was observed in the report — screenshots for visual changes.
4. New/changed behaviour gets a test in the same commit (unit for logic/validation, Playwright for a user-visible flow). Update the guide if a route, region, interaction, or testid changed.
5. Report honestly: executed vs. code-reviewed (this repo's rule already; the playbook makes "executed" achievable).

### 4. Docs wiring

- `AGENTS.md`: §1 doc map gets `docs/admin-ui-guide.md` ("where things are in the admin + how to verify"); §4 DoD already says tests are required (added 2026-09-01) — link the playbook.
- `_context.md`: point agents at the guide before any client task.

## Out of scope

Mobile app guide (Expo, Enhancement 2), server endpoint reference (OpenAPI already exists at `/openapi` in Development), redesigning any UI.

## Definition of Done

Per `_context.md`, plus: guide covers every route with all sub-headings filled and verified in a running Local app; every interactive element referenced by the guide has a testid in code; `pnpm typecheck` + `pnpm build` pass (testid props only — no behaviour change); AGENTS.md/_context.md link it; tick in `docs/patient-tasks.md`; delete this prompt on completion.
