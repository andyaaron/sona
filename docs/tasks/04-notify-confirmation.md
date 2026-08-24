# Task 04 — Confirmation before sending a notification (client-only)

**Prerequisite:** none (works against the current client; still correct after Task 03).
Read `docs/tasks/_context.md` and `AGENTS.md` first.

## Goal

Clicking "Notify" in the admin must not fire immediately — add a confirmation step to prevent accidental pings.

## Current state

`src/routes/patients/index.tsx` calls `useNotifyPatient()` **inline** (button markup + mutation directly in the route component). `features/notifications/components/notify-patient-button.tsx` still exists but is no longer imported anywhere — the route bypassed it.

## Requirements

1. Restore the bulletproof-react boundary while you're here: move the notify button + new confirmation into `NotifyPatientButton` (feature component) and have the route render it again — routes compose features, they don't inline mutation logic. Extend its props to take the display name (or the `Patient` object); do not fetch inside the button. Delete nothing else.
2. Add a confirmation UI before the mutation fires: a small accessible modal/dialog — "Send 'ready to be seen' notification to {firstName} {lastName}?" with Confirm/Cancel. (Patient name in the admin UI is fine — the compliance rule is about notification *content*, logs, and URLs, not the authenticated admin screen.)
3. Keyboard/a11y basics: Escape cancels, initial focus on Cancel, `aria-modal`/role dialog, click-outside cancels. No new dependency — plain React + Tailwind, matching existing styling idioms. If a generic dialog seems reusable, it belongs in `src/components/` (feature folders must not import from other features).
4. While the mutation is pending, disable Confirm and show the existing pending state; close on success/error as the current button behavior does.
5. This stays purely client-side — no contract, api-client, or server changes.

## Out of scope

Toast system, undo/cancel-after-send, batching.

## Definition of Done

Per `_context.md` (client-only: `pnpm typecheck` + `pnpm build`). Verify the flow in the running app if possible (`pnpm dev:admin`; the API may 404 the actual send until Task 03 — the dialog behavior is still verifiable), otherwise state that verification was build-only.
