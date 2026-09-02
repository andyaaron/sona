# Task 16 — Patient pages: notify/delete feedback gaps

**Prerequisites:** Read `docs/tasks/_context.md`, `AGENTS.md`, and `docs/admin-ui-guide.md` (§ `/patients`, § `/patients/manage`, § Shared components). Reproduce under the `Local` profile. Found 2026-09-02 while verifying Task 14.

## Bugs

1. **"Ready to be seen" gives no feedback.** `NotifyPatientButton` (`features/notifications/components/notify-patient-button.tsx`) only flips its label to "Notifying…" and closes the confirm dialog on settle. `useNotifyPatient` (`features/notifications/api/notify-patient.ts`) has no `onError`, and nothing toasts on success. A `4xx` from `POST /api/notifications/ready` (e.g. `400` when the patient has no SMS consent, `404` cross-org id) is invisible; the user only learns anything by expanding History. Verified: confirm → dialog closes, no toast, history shows a new `failed` row.
2. **Patient delete uses the native `window.confirm`** (`routes/patients/manage.tsx` `handleDelete`) instead of the shared `ConfirmDialog` every other confirm uses (Task 04). It is unstyled, not selectable by testid, and blocks the Playwright runner. Its `useDeletePatient` mutation also has no `onError`, so a failed `DELETE /api/patients/{id}` toasts nothing.
3. **Console warning on Add Patient:** "`value` prop on `select` should not be null" — `components/Form/sharedForm.tsx` sets `defaultValues.primaryProviderId: null` while `SelectField` renders `value={value}` (edit mode already maps `?? ''`). Harmless but noisy, and it will fail any test that asserts a clean console.

## Requirements

### 1. Notify feedback (`features/notifications/`)

- On success: `toast.success('Notification sent')` when `status` is `sent`/`delivered`/`pending`; when the audited row comes back `failed` (Local always does: `sms-not-configured`), `toast.error(`Notification failed: ${failureReason}`)` — the reason is an opaque code, never PHI. Keep the history invalidation.
- On error: toast the server `error` body when present (same `getErrorMessage` pattern the routes use — move that helper into `src/lib/` so features stop copy-pasting it; it currently exists 5× in `routes/`), else "Request failed (status)".
- The dialog still closes on settle; the button label behaviour is unchanged.

### 2. Delete confirmation (`routes/patients/manage.tsx`)

- Replace `window.confirm` with `ConfirmDialog` (`src/components/confirm-dialog.tsx`): title "Delete {First Last}?", `confirmLabel="Delete"`, `confirmDisabled` while the mutation is pending. One dialog instance in the route with `pendingDelete: Patient | null` state.
- `onError` → toast the server error; `onSuccess` keeps "Patient deleted".
- The row button `patients-manage-delete-<id>` and `confirm-dialog-*` ids already exist — no new testids needed.

### 3. Select default (`components/Form/sharedForm.tsx`)

- `primaryProviderId: ''` in `addPatientFormOpts.defaultValues` (the form already maps `''` → `null` on submit). Confirm the warning is gone in the console.

### 4. Guide + tests

- `docs/admin-ui-guide.md`: `/patients` interaction 5 gains the toasts; `/patients/manage` interaction 3 becomes the shared dialog (remove the `window.confirm` note); drop the three items from **Known gaps**.
- Tests (Task 12 toolchain if landed, otherwise state what was exercised by hand): unit for the toast branches of `useNotifyPatient`; Playwright for notify → toast and delete → dialog → row gone.

## Verification (Local, in the browser)

| # | Flow | Expected |
|---|---|---|
| 1 | Patients → Ready to be seen → Confirm | toast "Notification failed: sms-not-configured", history row `failed` |
| 2 | Same with a patient whose `smsConsent` is false (edit it first) | server 400 → toast with the server message, no history row |
| 3 | Manage Patients → Delete | `confirm-dialog` with "Delete {name}?" → Confirm → toast "Patient deleted", row gone; Cancel/Esc → nothing sent |
| 4 | Manage Patients → Add Patient | no `value` warning in the console |

## Out of scope

Redesigning the history panel, retry/resend, changing server responses.

## Definition of Done

Per `_context.md`: `pnpm typecheck` + `pnpm build` pass; table above executed; guide updated in the same commit; tick in `docs/patient-tasks.md`; delete this prompt.
