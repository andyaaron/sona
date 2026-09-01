# Task 11 — User invite/assign form bugs (seeded ids, org validation, hidden-field errors)

**Prerequisites:** Task 08 merged (org hierarchy, `UsersController`, `features/user-management`). Read `docs/tasks/_context.md` and `AGENTS.md` first. Reproduce against a db that has the seeded default org (`11111111-1111-1111-1111-111111111111`).

## Bugs (as reported 2026-09-01, system_admin caller)

1. Invite user → pick a directory user → role `org_admin` or `staff` → organization select appears → picking the only org ("Default Practice") shows **"Invalid UUID"** under the field; the form cannot be submitted.
2. Same flow but leave the organization unselected → the request is sent, the server answers **400** ("An organization is required for this role."), a toast shows the message, but **no error appears on the organization field**. Selecting the org afterwards hits bug 1.
3. Role `system_admin` → organization field (correctly) hidden → clicking **Invite does nothing**: no request, no error.

## Root causes (verified — see findings in the PR thread)

**A. zod v4 `.uuid()` is RFC 4122-strict and rejects the migration's seed ids (bugs 1, 3, and the tail of 2).**
`z.string().uuid()` in zod 4 requires version nibble 1–8 **and** variant nibble `8|9|a|b`. The Task 08 migration seeded `Organizations`/`Sites`/`Departments` with `11111111-1111-…`, `22222222-2222-…`, `33333333-3333-…` (variant nibble `1`/`2`/`3`). Confirmed with the installed zod 4.4.3:

```
11111111-1111-1111-1111-111111111111  z.string().uuid() → false ("Invalid UUID")   z.guid() → true
33333333-3333-3333-3333-333333333333  z.string().uuid() → false                    z.guid() → true
019b0e6a-7c3e-7f1a-8f2b-3c4d5e6f7a8b  z.string().uuid() → true                     z.guid() → true
```

Ids minted by `EntityBase` (`Guid.CreateVersion7()`) pass, which is why only the default org/site/department trip it. Nine fields in `packages/shared/src/schemas.ts` use `.uuid()`; the seeded `General` department fails the same way in `updateUserSchema.departmentIds` (staff assignment), `notifyPatientSchema.departmentId`, `updateSiteSchema.id`, `updateDepartmentSchema.id`.

**B. `inviteUserSchema` never requires an organization (bug 2).**
Only `updateUserSchema` carries the "org_admin/staff need an organization" refinement. `inviteUserSchema.organizationId` is `nullable().optional()` (org admins get their org filled in server-side), so a null org passes client validation, the server rejects with 400, and `routes/user-management/index.tsx` only surfaces server errors as a toast — nothing is mapped back onto a field.

**C. A stale value on a hidden field silently blocks submit (bug 3).**
`UserAccessForm`'s role listener clears `departmentIds` only. Switching to `system_admin` unmounts the organization select but leaves the previously chosen `organizationId` in form state; it fails A ("Invalid UUID") — and after A is fixed would still fail `updateUserSchema`'s "system_admin cannot belong to an organization" refinement in assign mode. TanStack Form's `handleSubmit` does not call `onSubmit` while any field has an error, and the failing field is not rendered, so nothing is shown and the button looks dead.

## Requirements

### 1. Contract — accept SQL Server `uniqueidentifier` values (`packages/shared/src/schemas.ts`)

- Replace every `z.string().uuid()` with `z.guid()` (zod 4: any `8-4-4-4-12` hex string). Fields: `createPatientSchema.primaryProviderId`, `updateProviderSchema.id`, `updateSiteSchema.id`, `updateDepartmentSchema.id`, `updateUserSchema.organizationId` + `departmentIds`, `inviteUserSchema.departmentIds` + `organizationId`, `notifyPatientSchema.departmentId`.
- Rationale to leave as a one-line comment near the first use: SQL Server `uniqueidentifier` (and the fixed seed ids) are not guaranteed RFC 4122 — `.uuid()` in zod 4 is strict.
- **Do not** re-key the seed rows with a new migration (rejected: dev db already migrated; the rows sit behind four FKs).
- Inferred TS types are unchanged (`string`), so no consumer edits are expected — verify with `pnpm typecheck`.

### 2. Contract — `inviteUserSchema` requires an org for org-scoped roles

- Add the same refinement `updateUserSchema` has: `role === "org_admin" || role === "staff"` ⇒ `organizationId !== null`, message "An organization is required for this role", `path: ["organizationId"]`.
- Keep `system_admin` ⇒ `organizationId` may be null. (Invite already excludes `unassigned`.)
- org_admin callers are unaffected: `UserAccessForm` pre-fills `organizationId` with the caller's org, and `UsersController.InviteUser` still overrides it with the caller's org server-side.

### 3. Form — `apps/sona.client/src/features/user-management/components/user-access-form.tsx`

- **Role listener** resets `organizationId` alongside `departmentIds`: `system_admin` / `unassigned` ⇒ `null`; `org_admin` / `staff` ⇒ restore `initialValues.organizationId` (the caller's org for org_admin callers, `null` for system_admin callers so they must pick).
- **Visible form-level errors:** render a summary block above the submit row from `form.state.errorMap` / the field error map (TanStack `form.Subscribe` on `state.errorMap` + `state.fieldMeta`), so an error on an unmounted field is always visible. Keep the per-field rendering as is.
- **Server errors on the form, not only a toast:** on mutation `onError`, if the body carries `{ error }`, set it as a form-level error (`form.setErrorMap({ onServer: message })` or equivalent for the installed `@tanstack/react-form` version — check the 1.x API, do not guess) and keep the toast. The route's `handleInvite`/`handleAssign` need a way to hand the message to the form (callback or returned promise rejection — pick the simpler one consistent with `providers/manage.tsx`).
- Departments picker: unchanged, but re-verify the staff flow against the seeded `General` department now that A is fixed (it should auto-scope silently when the org has one department).

### 4. Verification (manual, against the seeded default org)

Repro matrix — every row must pass before done:

| # | Caller | Flow | Expected |
|---|---|---|---|
| 1 | system_admin | Invite → staff → pick Default Practice → Invite | 201, user appears in list, no "Invalid UUID" |
| 2 | system_admin | Invite → staff → leave org unselected → Invite | Blocked client-side with "An organization is required for this role" under the org field; no request sent |
| 3 | system_admin | Invite → pick Default Practice → switch role to system_admin → Invite | 201, `organizationId` null in the request |
| 4 | system_admin | Assign a pending user → staff → Default Practice | 201, `departmentIds` = [General] auto-scoped, no error |
| 5 | org_admin (Default Practice) | Invite → staff | Org field hidden, request carries the caller's org, 201 |
| 6 | staff (Default Practice, General dept) | Ready to be seen | `POST /api/notifications/ready` accepts `departmentId` = General's seed id |

## Out of scope

Re-seeding ids, any change to `UsersController` validation (server rules are correct), redesigning the invite UX, directory search behaviour.

## Definition of Done

Per `_context.md`. Additionally: `pnpm typecheck` + `pnpm build` pass; the six-row matrix above is executed against a real db (state which rows were executed vs. code-reviewed); tick this task in `docs/patient-tasks.md`; delete this prompt on completion (repo convention).
