# Sona admin — UI guide & verification playbook

**This is the registry of where things are in the admin (`apps/sona.client`) and how to prove a
change works.** It is read by agents and by tests. Every claim below was verified in a running
`Local` app on 2026-09-02 unless marked *(unverified)*. If this document disagrees with the app,
the commit that changed the app is incomplete (AGENTS.md §4).

Rules that keep it true:

- **Any user-noticeable change updates this file in the same commit** — new/removed/moved/renamed
  controls (placement counts: left↔right, toolbar↔row, inline↔dialog), changed click paths,
  validation text, toasts, empty states, role gates, `data-testid`s.
- **A `data-testid` that is not listed here is a bug.** Add it to the page section when you add it
  to the code.
- Positions are described as *page → region → position within the region*.

---

## Verification playbook (run for every frontend change)

1. `pnpm typecheck && pnpm build && pnpm test` — Vitest unit/component tests (`packages/shared/src/schemas.test.ts`,
   `apps/sona.client/src/**/*.test.tsx`; helpers in `apps/sona.client/src/testing/`).
2. Start the Local API + admin — [getting-started.md § Running locally without Azure](getting-started.md#running-locally-without-azure-local-profile) —
   and run `pnpm --filter sona.client e2e --grep @smoke` (Playwright, `apps/sona.client/e2e/`; `pnpm e2e` for the full suite).
3. **Exercise the changed path in the browser** following the numbered interactions in this guide
   (agent browser tool, or `pnpm --filter sona.client e2e:codegen`), and **quote what was observed** in the report:
   toasts, validation text, request + status code, screenshot for visual changes.
4. New/changed behaviour ships with a test in the same commit (Vitest for logic/validation/component
   state, a Playwright spec for a user-visible flow — tag `@smoke` when it should block PRs).
5. **Update this guide in the same commit** for anything a user could notice (see rules above).
6. Report honestly: *executed* vs *code-reviewed*, per flow.

Selector rule for tests and agents: **select by `data-testid`**, never by Tailwind class or button
copy. Toasts are `sonner` — select `[data-sonner-toast]` and match text.

### Switching roles in Local

Roles are real (read from `AppUsers.Role`); the stub user (`DEV001`) is promoted to `system_admin`
once on a fresh db. The API refuses `PUT /api/users/{ownId}` with `400 "You cannot change your own
role."`, so to see the app as another role change the row directly:

```sql
-- org_admin of the seeded org
UPDATE AppUsers SET Role='org_admin', OrganizationId='11111111-1111-1111-1111-111111111111' WHERE HCAID='DEV001';
-- staff in every department (header picker appears when > 1)
UPDATE AppUsers SET Role='staff', OrganizationId='11111111-1111-1111-1111-111111111111' WHERE HCAID='DEV001';
INSERT INTO UserDepartmentAccesses (Id, AppUserId, DepartmentId, CreateDate, ModDate)
  SELECT NEWID(), 1, Id, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Departments;
-- pending screen
UPDATE AppUsers SET Role='unassigned' WHERE HCAID='DEV001';
-- back
UPDATE AppUsers SET Role='system_admin', OrganizationId=NULL WHERE HCAID='DEV001';
DELETE FROM UserDepartmentAccesses WHERE AppUserId=1;
```

(Docker: `docker exec sona-sql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P '<pw>' -d SonaLocal -Q "…"`.)
No restart needed — the role is read per request. A second `unassigned` row (any `HCAID`) is
enough to exercise the pending-approval table.

---

## How to run

| What | Where |
|---|---|
| API (Local profile) | `dotnet run --project apps/sona.server --launch-profile "sona.server (Local)"` → `http://localhost:5032` + `https://localhost:7296` |
| Admin | `pnpm dev:admin` → `https://localhost:5173` (dotnet dev cert; `/api` and `/auth` proxy to 7296) |
| Dev login | No sign-in screen. Every request is the `LocalDevAuth` identity from `appsettings.Local.json` (`DEV001` / "Dev Admin" / `dev.admin@example.com`). |
| Setup | [getting-started.md § Local profile](getting-started.md#running-locally-without-azure-local-profile) |

`VITE_API_URL` stays empty (`.env.example`): the admin calls `/api` on its own origin and Vite proxies it.
A browser that rejects the untrusted dev cert (`dotnet dev-certs https --trust` fixes that) can run Vite over
plain http with a config that spreads `vite.config.ts` with `server.https: false`.

---

## Roles & what each sees

| Role | Header nav | Blocked routes (client gate → page text) | Notes |
|---|---|---|---|
| `system_admin` | Dashboard, Patients, Providers, User Management, Organization, Organizations | none | No org of their own: header shows id only; Organization page needs the org picker; **cannot create patients/providers from the UI** (Task 15) |
| `org_admin` | Dashboard, Patients, Providers, User Management, Organization | `/organizations` → "Only system administrators can manage organizations." | Header shows `DEV001 · Default Practice`; Organization page opens straight on their org |
| `staff` | Dashboard, Patients | `/providers/manage` → "Only organization administrators can manage providers."; `/user-management` → "Only organization administrators can manage users."; `/organization` → "Only organization administrators can manage sites and departments."; `/organizations` as above | Header gets the **Department** picker when the user has > 1 department |
| `unassigned` | *(no shell)* | everything — server `AssignedUser` policy answers `403` | Whole app replaced by the pending screen (below) |

Client gates are UX only; the server policies (`SystemAdmin`, `OrgAdmin`, `AssignedUser`) are what
actually block. Direct URL navigation to a gated route renders the gate text inside the normal shell.

### Pending-approval screen (`role === "unassigned"`)

Replaces the whole shell (no header). Centered card `pending-approval`: logo, heading
"Access pending approval", copy "Hi {displayName}, you're signed in, but an administrator at your
practice still needs to grant you access. You'll be able to use Sona as soon as they do."
Toasts still render. Verified.

### `/auth/login` bounce

`apiFetch` calls `onUnauthorized` on any `401`, which sets `window.location.href = '/auth/login'`
(never resolves the promise). In Local the API answers `302 → AzureAd:RedirectUri`
(`https://localhost:5173/`) — verified with curl; the redirect target is the Entra challenge in
Development/Production. A `401` cannot occur in Local (stub auth), so the bounce itself is *(unverified in-browser)*.

---

## Seeded data on a fresh Local db

| Thing | Id / value | Source |
|---|---|---|
| Organization "Default Practice" (practice) | `11111111-1111-1111-1111-111111111111` | migration `OrgHierarchyAndRoles` |
| Site "Main" | `22222222-2222-2222-2222-222222222222` | same |
| Department "General" (Main) | `33333333-3333-3333-3333-333333333333` | same |
| Message template `ready-to-be-seen` | `8f7f4b6a-0000-4000-8000-000000000001`, body "You're ready to be seen. Please come to the front desk." | migration `AddMessagingTables` + `LocalDevMode.SeedAsync` |
| App user DEV001 | `Id 1`, `system_admin`, no org | JIT on first request (`LocalDevJitUserMiddleware`) |

No patients, providers, or notifications are seeded. ⚠️ The three fixed ids above are not RFC-4122
and fail zod v4 `.uuid()` in the client — see [Known gaps](#known-gaps--open-bugs) (Task 11).

---

## Global chrome

Root layout (`routes/__root.tsx`): `header` on top, then `main` (`data-testid="main"`, padding 6)
containing the route. While `/api/user` loads: `app-loading` ("Loading..."); on error: `app-error`
("Error: …"). Toaster: `sonner`, top-right, rich colors.

### Header (`header`, full-width, bottom border)

Left → right:

| Position | Element | testid | Notes |
|---|---|---|---|
| far left | Sona logo (link to `/`) | `header-logo` | |
| nav | Dashboard | `header-nav-dashboard` | active link is emerald |
| nav | Patients | `header-nav-patients` | → `/patients` |
| nav | Providers | `header-nav-providers` | → `/providers/manage`; org_admin + system_admin only |
| nav | User Management | `header-nav-user-management` | org_admin + system_admin only |
| nav | Organization | `header-nav-organization` | org_admin + system_admin only |
| nav | Organizations | `header-nav-organizations` | system_admin only |
| right cluster | "Department" select | `header-department-select` | **staff with > 1 department only.** Options: "Choose…" + each department name. Selection persists in `localStorage` key `sona.department-context` and rides on notify sends as `departmentId` |
| far right | user chip (icon + two lines) | `header-user`, `header-user-name`, `header-user-id`, `header-org-name` | line 2 = `DEV001` + ` · Default Practice` (`header-org-name`, only when the user has an org) |
| far right (no user) | "Authenticate" button | `header-authenticate` | *(unverified — never rendered in Local)* |

---

## Pages

### `/` — Dashboard

- **Purpose:** time-ordered **day sheet** of the external **Opie** schedule (read-only PHI; docs/opie-odbc-integration.md) with a per-row "Ready to be seen" button. Waiting-room queue / notification history still to come.
- **Who:** users of the organization the Opie schedule is bound to (`Opie:OrganizationId` on the API) plus `system_admin`. Anyone else gets `404 opie-not-available` from the API and the **section is not rendered at all** (no notice — other orgs must not learn a clinic exists); the dashboard heading/paragraph still show.
- **Layout:** heading "Dashboard" + placeholder paragraph, then the **Opie Schedule** section (`opie-schedule`).
  - **Toolbar** (`opie-schedule-toolbar`, left → right): heading "Opie Schedule" · (pushed to the right) day stepper `‹` (`opie-schedule-prev-day`, aria-label "Previous day") · **Today** (`opie-schedule-today`, secondary; disabled while the shown date is today) · `›` (`opie-schedule-next-day`, aria-label "Next day") · native date input (`opie-schedule-date`, value = `?date=` or today) · summary (`opie-schedule-summary`, "Thu, Sep 3 · N appointments · M patients", plus " · K internal" only when the day has internal blocks; appointments/patients never count the placeholder).
  - **Day sheet** (`opie-schedule-sheet`, plain table — no sort/paging, the whole day in time order): header Time · Patient · Contact · Comment · (blank, actions). (No practitioner column: Opie only exposes the patient's *primary* practitioner, not who an appointment is with, so it was dropped rather than mislead.) Body = one **hour header** row per hour (`opie-schedule-hour-<HH>`, 24h two-digit, e.g. `opie-schedule-hour-09` reads "9 AM") from the hour of the first appointment to the hour containing the last end time; under each hour either its appointment rows or one italic "No appointments" row (`opie-schedule-empty-hour-<HH>`). **Appointment row** `opie-schedule-row-<opiePatientId>-<n>` (`n` = index in that patient's `appointments[]`; a patient booked twice has two rows in two hours), left → right: Time (`start – end`, local, monospace) · Patient ("Last, First Middle" + second line `"Nickname" · Language` when present) · Contact (one line per phone `number (country)` — extensions are not shown — then the email in small text) · Comment (truncated, full text on hover) · **Ready to be seen** (`opie-notify-<opiePatientId>-<n>`, primary; disabled with title "No mobile number on file in Opie" when no phone row normalises to E.164). Rows within an hour sort by start time, then last name. Appointments with no start time go under a trailing "No start time" header (`opie-schedule-unscheduled`). When the shown date is today, a red rule (`opie-schedule-now`) marks the current time after the rows that have already started (only while "now" falls inside the sheet's hours). Missing values render as "—". **Internal block row** (`opie-schedule-block--9999-<n>` — staff time booked against Opie's shared `-9999` placeholder: LUNCH, meetings…): amber background (`bg-amber-50`, amber text), Time cell as normal, then one merged cell with an "INTERNAL" badge + the block's comment (or "Internal block" when empty; full comment on hover), **no** patient/contact data (the API redacts them) and **no** notify button. Blocks occupy their hour like appointments, so an hour with only a block is not "No appointments".
  - **States** (replace the sheet, toolbar stays): `opie-schedule-loading` "Loading schedule…" · `opie-schedule-empty` "No Opie appointments on this date." · `opie-schedule-unconfigured` "Opie connection not configured. Set ConnectionStrings:OpieConnection on the API to load the schedule." (API `503 opie-not-configured` — no `OpieConnection` *or* no `Opie:OrganizationId`; the default in CI and on any machine without Opie credentials) · `opie-schedule-error` "Could not load the Opie schedule: …" (API `502 opie-unavailable` or other failure).
- **Interactions:**
  1. Pick a date in `opie-schedule-date`, or click `‹` / `›` / **Today** → URL `?date=YYYY-MM-DD` → `GET /api/opie/schedule?date=…`. Invalid `?date=` in the URL is rejected by the route's zod search validation.
  2. Notify: click `opie-notify-<id>-<n>` → `confirm-dialog` opens, title "Send 'ready to be seen' notification to {Last, First}?", body shows the number that will be dialled (`opie-notify-number`, as stored in Opie) and a checkbox **"Patient has consented to SMS"** (`opie-notify-consent`). `confirm-dialog-confirm` stays disabled until it is checked (TCPA — Opie has no consent field, so the sender attests). Confirm → `POST /api/opie/notify {opiePatientId, mobileNumber (E.164), departmentId, smsConsentAttested: true}` → dialog closes on settle and the checkbox resets. `201` body is the audited `MessageOut` (`patientId: null`, `opiePatientId` set, `smsConsentAttested: true`): `status` ≠ `failed` → toast **"Notification sent"**; `failed` → error toast **"Notification failed: {failureReason}"** (Local always: `sms-not-configured`). `409` (consent not attested) / `400` → error toast with the body's `error`; the button re-enables. The department sent must belong to the bound organization (`400 Unknown department.` otherwise).
- **API:** `GET /api/opie/schedule?date=` · `POST /api/opie/notify`.
- **Compliance:** every cell is PHI (names, contact details, clinical comment, encounter times) — display only. The notify path persists a `MessagesOut` row *before* dispatch, keyed by `OpiePatientId` (no Sona patient exists) with `SmsConsentAttested`; the SMS body is the generic approved template. The API logs counts + the date, never row content.

### `/patients` — Patients (notify list)

- **Purpose:** find a patient and tell them they're ready to be seen; see their notification history.
- **Who:** every assigned role (server: `AssignedUser`; results org-scoped, system_admin sees all orgs mixed).
- **Layout:** toolbar row, then the table.
  - **Toolbar** (`patients-toolbar`, left → right): heading "Patients" · **Manage Patients** button (`patients-manage-link`, secondary, links to `/patients/manage`) · search icon (`patients-search-toggle`) that expands an input to its right (`patients-search-input`, placeholder "Search by name or MRN…", ✕ `patients-search-clear` inside the input clears + collapses) · **provider filter** select (`patients-provider-filter`, "All Providers" + active providers).
  - **Table** (`patients-table`): title row above it holds only the page-size select on the right ("Show [10|25|50|100] entries", `patients-table-page-size`). Columns: Name (`-header-lastName`, sortable) · MRN (`-header-mrn`, sortable) · DOB (`-header-dob`, sortable) · actions (`-header-actions`, blank header). Name cell = "First Last" + second line "App user — will receive push" / "No app — will receive SMS" · provider name or "Unassigned". Actions cell, right-aligned, left → right: **History** (`patients-history-<id>`, toggles to "Hide history", `aria-expanded`) · **Ready to be seen** (`notify-button-<id>`, primary; reads "Notifying…" while pending).
  - Expanded row (`patients-table-expanded-<id>`) directly under the patient: the history panel (below).
  - Footer: `patients-table-row-count` ("Showing N of M rows") left; First/Previous/"Page X of Y"/Next/Last right (`patients-table-page-first|previous|info|next|last`).
- **Interactions:**
  1. Search: click `patients-search-toggle` → type → 300 ms debounce → URL `?search=…`, page resets, `GET /api/patients?search=…`. Click `patients-search-clear` → input empties/collapses, param removed.
  2. Sort: click the header button inside `patients-table-header-mrn` → `?sortBy=mrn&sortDir=asc`, `aria-sort="ascending"`; click again → desc. Single-column only.
  3. Page size / paging → `?pageSize=` / `?page=` (defaults 25 / 1 omitted from the URL).
  4. Provider filter → `?providerId=<guid>`.
  5. Notify: click `notify-button-<id>` → `confirm-dialog` opens, title "Send 'ready to be seen' notification to {First Last}?" → `confirm-dialog-confirm` (or `confirm-dialog-cancel` / Esc / backdrop click) → `POST /api/notifications/ready {patientId, departmentId}` → dialog closes on settle, history query invalidated. `201` body is the audited `MessageOut`; the toast reflects it: `status` ≠ `failed` → **"Notification sent"**; `failed` → error toast **"Notification failed: {failureReason}"** (Local always: `sms-not-configured`). A server `4xx` → error toast with the body's `error` (e.g. `409` "Patient has not consented to SMS. Capture consent before notifying." — that attempt is still audited as `failed` / `sms-consent-missing`).
  6. History: click `patients-history-<id>` → expanded row renders `NotificationHistory`.
- **History panel** (`features/notifications/components/notification-history.tsx`, `patientId` suffix on every id): loading `notification-history-loading-<id>` "Loading history…"; error `notification-history-error-<id>` "Failed to load notification history."; empty `notification-history-empty-<id>` "No notifications sent yet."; otherwise an unbordered table `notification-history-table-<id>` (rows `…-row-0`, `…-row-1` — index ids, newest first) with columns Channel ("SMS"/"PUSH") · Status pill (`pending|sent|delivered|failed`; hover title = `failureReason`) · Created · Sent · Delivered (`—` when null). In Local every send is `failed` / `sms-not-configured`.
- **API:** `GET /api/patients?page&pageSize&sortBy&sortDir&search&providerId` · `GET /api/providers?isActive=true` · `POST /api/notifications/ready` · `GET /api/patients/{id}/notifications`.
- **States:** empty table → `patients-table-empty` "No patients found."; route loader suspends on the patients query (root "Loading..." on first load).

### `/patients/manage` — Manage Patients

- **Purpose:** CRUD patients.
- **Who:** every assigned role (server: `AssignedUser`; org-scoped).
- **Layout:** toolbar → (form card when open) → table.
  - **Toolbar** (`patients-manage-toolbar`): heading "Manage Patients" · **Add Patient** (`patients-manage-add-button`, primary; becomes secondary **Cancel** with `aria-expanded=true` while the create form is open) · search toggle/input/clear (`patients-manage-search-*`, same behaviour as `/patients`, server-side).
  - **Form card** (`patient-form`, white bordered card between toolbar and table): header row = title `patient-form-title` ("Add patient" / "Edit patient") left, **Cancel** (`patient-form-cancel`) + submit (`patient-form-submit`, "Create patient" / "Save changes", "Saving…" while pending) right. Two-column grid: MRN (`patient-form-mrn`) · Date of birth (`patient-form-dob`, placeholder `YYYY-MM-DD`) · First name (`patient-form-first-name`) · Last name (`patient-form-last-name`) · Phone number full-width (`patient-form-phone-number`, placeholder `+15551234567`) · "SMS consent captured" checkbox (`patient-form-sms-consent`) · Primary Provider select (`patient-form-primary-provider`, "Unassigned" + active providers). Field errors render under the field as `<testid>-error`.
  - **Table** (`patients-manage-table`, same columns/paging as `/patients`; Name second line = phone · provider). Actions right-aligned: **Edit** (`patients-manage-edit-<id>`, secondary) · **Delete** (`patients-manage-delete-<id>`, ghost).
- **Interactions:**
  1. Add: `patients-manage-add-button` → form opens in create mode. Submit empty → inline errors "MRN is required", "Date of birth is required", "First name is required", "Last name is required", "Phone number must be E.164 format (+15551234567)" (zod `createPatientSchema`; SMS consent has no client message). Valid → `POST /api/patients` → toast **"Patient added successfully"**, form closes, list refetches. Server `4xx` → toast with the body's `error` (e.g. `409` "A patient with this MRN already exists."; **as system_admin: `400` "organizationId is required for system admins."** — Task 15).
  2. Edit: `patients-manage-edit-<id>` → same form prefilled, title "Edit patient", submit "Save changes" → `PUT /api/patients/{id}` → toast "Patient updated successfully". "Unassigned" in the provider select submits `primaryProviderId: null` (until 2026-09-02 it failed validation as "Invalid GUID" and the form would not save).
  3. Delete: `patients-manage-delete-<id>` → shared `confirm-dialog` (title `confirm-dialog-title` "Delete {First Last}?", `confirm-dialog-confirm` reads "Delete", disabled while pending) → `DELETE /api/patients/{id}` (soft) → toast "Patient deleted", row gone; failure → error toast with the server message. Cancel / Esc / backdrop click → nothing sent.
  4. Toolbar Cancel or form Cancel → form closes, nothing sent.
- **API:** `GET /api/patients…` · `GET /api/providers?isActive=true` (loader) · `POST/PUT/DELETE /api/patients`.
- **States:** empty → `patients-manage-table-empty` "No patients found."

### `/providers/manage` — Manage Providers

- **Purpose:** CRUD providers (soft deactivate).
- **Who:** org_admin, system_admin (decided 2026-09-02, Task 18 — providers are org reference data). Others: `providers-forbidden` "Only organization administrators can manage providers." Server: `POST`/`PUT /api/providers` require the `OrgAdmin` policy (`403` otherwise); `GET /api/providers` stays open to every assigned role because the patient form and the patients provider filter need the list.
- **Layout:** toolbar → (form card) → table.
  - **Toolbar** (`providers-toolbar`): heading "Manage Providers" · **Add Provider** (`providers-add-button`, toggles to Cancel, `aria-expanded`) · search (`providers-search-toggle|input|clear`, placeholder "Search by name or NPI…", **client-side** filter on first/last name or NPI, no URL param).
  - **Form card** (`provider-form`): title `provider-form-title` ("Add provider"/"Edit provider"), **Cancel** `provider-form-cancel`, submit `provider-form-submit` ("Create provider"/"Save changes"). Grid: First name (`provider-form-first-name`) · Last name (`provider-form-last-name`) · Credentials (`provider-form-credentials`, placeholder "e.g. MD, DO, NP") · NPI (`provider-form-npi`, "10-digit NPI") · Specialty full-width (`provider-form-specialty`). Errors `<testid>-error`.
  - **Table** (`providers-table`, client-side sort + paging, page size default 10): Name (`-header-lastName`; "First Last, CREDS" + red "(Inactive)") · NPI (`-header-npi`; "No NPI" grey) · Specialty (`-header-specialty`; "—") · actions. Actions right-aligned: **Edit** (`providers-edit-<id>`) · **Deactivate** / **Reactivate** (`providers-toggle-active-<id>`, ghost, immediate — no confirm).
- **Interactions:** Add → `POST /api/providers` → toast "Provider added successfully" (system_admin gets the same `400 organizationId…` as patients — Task 15, *code-reviewed*). Edit → `PUT /api/providers/{id}` → "Provider updated successfully". Toggle → `PUT` with `isActive` → "Provider deactivated" / "Provider reactivated".
- **API:** `GET /api/providers` · `POST /api/providers` · `PUT /api/providers/{id}`.
- **States:** empty → `providers-table-empty` "No providers found." (this is what a fresh Local db shows).

### `/user-management` — User Management

- **Purpose:** approve pending sign-ins, assign roles/org/departments, invite from the HCA directory.
- **Who:** org_admin, system_admin. Others: `users-forbidden` "Only organization administrators can manage users."
- **Layout:** toolbar → (form card) → pending table (only when non-empty) → users table.
  - **Toolbar** (`users-toolbar`, left → right): heading "User Management" · **Invite user** (`users-invite-button`, toggles to Cancel, `aria-expanded`) · search (`users-search-toggle|input|clear`, "Search by name, email, 34 ID…", client-side over displayName/email/hca34Id) · **Role filter** pushed to the far right (`users-role-filter`: "All" + System admin (system_admin only) / Org admin / Staff; applies to the users table only).
  - **Form card** (`user-access-form`, shared by invite + assign): title row with `user-access-form-title` ("Invite a user" / "Approve {name}" for pending / "Edit {name}"), **Cancel** `user-access-form-cancel`, submit `user-access-form-submit` ("Invite" / "Save access"). Between the title row and the fields: **error summary** `user-access-form-errors` (red box, `role=alert`, one line per message) — shown only when there is a form-level error (a server rejection, e.g. `400 "You cannot change your own role."`, alongside its toast) or an error on a field that is currently hidden (organization/departments/34 ID when not rendered). Fields in grid order:
    - *invite only, full-width:* "Find person (34 ID)" text input `user-access-form-directory-input` (placeholder "Start typing a 34 ID…", 300 ms debounce, ≥ 2 chars → `GET /api/users/directory-search?q=`). Results list `user-access-form-directory-results` with one button per hit `user-access-form-directory-hit-<hca34Id>`; "Searching…"; `user-access-form-directory-empty` "No matches."; `user-access-form-directory-error` "Directory search is unavailable right now."; after picking: `user-access-form-directory-selected` "Selected: …". Submit without a pick → `user-access-form-directory-input-error` "34 ID is required". **Local returns no matches** (MSGraph not configured).
    - Role select `user-access-form-role` — options: system_admin (system_admin callers only), org_admin, staff, plus "Unassigned (no access)" in assign mode. Defaults: staff. Changing the role also resets the hidden state: system_admin/unassigned clear the organization (and departments); org_admin/staff keep the current organization or fall back to the initial one (the caller's org for org_admin callers, the edited user's org in assign mode, none for a system_admin invite).
    - Organization select `user-access-form-organization` — **system_admin callers only, and only when role is org_admin/staff** (org_admin's org is fixed server-side). "Select an organization…" + active orgs (seeded ids such as Default Practice are accepted — the contract validates ids with `z.guid()`). Errors `user-access-form-organization-error`: submitting org_admin/staff with no organization → "An organization is required for this role" (client-side, no request; invite + assign).
    - Departments fieldset `user-access-form-departments` — **role = staff and the org has > 1 active department**; one checkbox per department `user-access-form-department-<id>` labelled "Name (Site)". Errors `user-access-form-departments-error` ("Pick at least one department for this staff member").
  - **Pending table** (`users-pending-table`, title `users-pending-table-title` "Pending approval (N)", no paging): Name (`-header-displayName`: "Name" + "DEV002 · email") · First sign-in (`-header-lastLogin`) · actions → **Assign** (`users-assign-<id>`, primary, far right).
  - **Users table** (`users-table`, title "Users", page size 10): Name · Role (`-header-role`) · Organization (`-header-organizationId`, **system_admin only**; org name or "—") · Departments (`-header-departments`; "All" for non-staff, names or count for staff) · actions → **Edit** (`users-edit-<id>`, far right).
- **Interactions:**
  1. Approve: `users-assign-<id>` → form "Approve {name}", role defaults to staff → pick role (+ org for system_admin) → submit → `PUT /api/users/{id}` → toast **"User updated"**, form closes, user moves from pending to users table. Verified (DEV002 → system_admin).
  2. Edit: `users-edit-<id>` → "Edit {name}", prefilled. Same request/toast. Editing **yourself** → server `400 "You cannot change your own role."` → toast **and** the same text in `user-access-form-errors`; the form stays open with its values.
  3. Invite: `users-invite-button` → form "Invite a user" → directory pick → role/org → **Invite** → `POST /api/users/invite` → toast "User invited". A server rejection toasts and fills `user-access-form-errors`. Cannot be completed in Local (no directory) — the validation states (missing 34 ID, missing organization, role switching) can.
  4. Role filter / search narrow the users table only.
- **API:** `GET /api/users` · `GET /api/organizations` · `GET /api/organizations/{id}/sites` + `GET /api/sites/{id}/departments` (department names, org_admin only) · `PUT /api/users/{id}` · `POST /api/users/invite` · `GET /api/users/directory-search?q=`.
- **States:** users query error → `users-error` red text under the toolbar; tables show `-loading` "Loading…" while pending; users empty → `users-table-empty` "No users found."; pending table absent when there is nothing pending.

### `/organization` — Organization (sites & departments)

- **Purpose:** manage the caller's org structure.
- **Who:** org_admin (own org, no picker), system_admin (must pick). Others: `organization-forbidden` "Only organization administrators can manage sites and departments."
- **Layout:** toolbar → sites block → departments block.
  - **Toolbar** (`organization-toolbar`): heading `organization-title` = org name, or "Organization" until one is picked · **org select** `organization-org-select` (system_admin only: "Select an organization…" + orgs). Before a pick: `organization-empty` "Pick an organization to manage its structure." (org_admin with no org: "No organization assigned.").
  - **Sites** — hidden while the org has exactly one active site and no inactive ones: `org-sites-single` "Single site (Main). [Add another site]" (`org-sites-show-button`, green link). Clicking it (or having > 1 site) shows the block: toolbar `org-sites-toolbar` = heading "Sites" · **Add site** (`org-sites-add-button`, toggles Cancel) → `site-form` (title `site-form-title` "Add site"/"Rename {name}", field `site-form-name` "Site name", `site-form-cancel`, `site-form-submit` "Create site"/"Save") → table `org-sites-table` (no paging; Site column `-header-name` with "(Inactive)"; actions far right: **Departments** `org-sites-select-<id>` (primary when it is the selected site, `aria-pressed`) · **Rename** `org-sites-rename-<id>` · **Deactivate/Reactivate** `org-sites-toggle-active-<id>`).
  - **Departments** — for the selected site (first active by default): toolbar `org-departments-toolbar` = heading `org-departments-title` "Departments — {site}" · **Add department** (`org-departments-add-button`, toggles Cancel) → `department-form` (`department-form-title`, `department-form-name` "Department name", `department-form-cancel`, `department-form-submit` "Create department"/"Save") above the table → `org-departments-table` (no paging; Department `-header-name`; actions far right: **Rename** `org-departments-rename-<id>` · **Deactivate/Reactivate** `org-departments-toggle-active-<id>`).
- **Interactions (verified as system_admin on Default Practice):**
  1. Pick org → sites/departments load (`GET /api/organizations/{id}/sites`, `GET /api/sites/{id}/departments`).
  2. Add department: submit empty → `department-form-name-error` "Department name is required"; valid → `POST /api/sites/{siteId}/departments` → toast **"Department added"**, form closes, row appears.
  3. Rename department → `PUT /api/departments/{id}` → "Department renamed". Deactivate → "Department deactivated" / "Department reactivated"; deactivating the last active one is blocked client-side with toast error "A site needs at least one active department."
  4. Sites: Add → `POST /api/organizations/{id}/sites` "Site added"; Rename → `PUT /api/sites/{id}` "Site renamed"; Deactivate → "Site deactivated"/"Site reactivated", last active blocked with "An organization needs at least one active site." *(site mutations code-reviewed, not executed)*
- **States:** `org-sites-table-empty` "No sites yet.", `org-departments-table-empty` "No departments yet.", `-loading` while pending.

### `/organizations` — Organizations

- **Purpose:** system_admin creates practices/hospitals.
- **Who:** system_admin. Others: `organizations-forbidden` "Only system administrators can manage organizations."
- **Layout:** toolbar (`organizations-toolbar`: heading "Organizations" · **Add organization** `organizations-add-button`, toggles Cancel, `aria-expanded`) → form card → table.
  - **Form** (`organization-form`): title "Add organization", **Cancel** `organization-form-cancel`, submit `organization-form-submit` "Create organization"; fields Name (`organization-form-name`) · Type select (`organization-form-type`: Practice / Hospital, default Practice); helper text "A "Main" site and "General" department are created automatically."
  - **Table** (`organizations-table`, client paging, page size 10): Name (`-header-name`, "(Inactive)" flag) · Type (`-header-type`) · Created (`-header-createDate`). **No row actions.**
- **Interactions:** Add → `POST /api/organizations` → toast "Organization created", form closes. *(create executed only via the form open/close; the POST was code-reviewed)*
- **API:** `GET /api/organizations` · `POST /api/organizations`.
- **States:** `organizations-table-empty` "No organizations yet."

---

## Shared components (testid derivation rules)

| Component | Prop | Emits |
|---|---|---|
| `components/Table/Table.tsx` | `testId="x"` | `x` (the `<table>`), `x-title`, `x-page-size`, `x-header-<columnId>` (each `<th>`; sortable headers contain a `<button>` and set `aria-sort`), `x-row-<rowId>` (`rowId` = `getRowId` result — the entity id — else the row index), `x-expanded-<rowId>`, `x-empty`, `x-loading`, and via Pagination `x-row-count`, `x-page-info`, `x-page-first|previous|next|last` |
| `components/Table/Pagination.tsx` | `testId` (passed by Table) | the `x-page-*` / `x-row-count` ids above |
| `components/search-input.tsx` | `testId="x"` | `x-toggle` (icon button, `aria-expanded`), `x-input`, `x-clear` (✕ inside the input; clears the value and collapses) |
| `components/confirm-dialog.tsx` | — (fixed ids, one dialog at a time) | `confirm-dialog` (role=dialog), `confirm-dialog-title`, `confirm-dialog-cancel` (initial focus), `confirm-dialog-confirm`. Esc / backdrop click = cancel |
| `components/Form/TextField.tsx`, `TextAreaField.tsx`, `SelectField.tsx` | `testId="x"` | `x` on the control, `x-error` on each error line (shown after touch or submit) |
| `components/NavLink.tsx` | `testId` | on the link |
| `components/button.tsx` | spreads props | pass `data-testid` directly |
| Feature forms | fixed ids | `patient-form-*`, `provider-form-*`, `user-access-form-*`, `organization-form-*`, `site-form-*` / `department-form-*` (NameForm, prefixed by `kind`) |

Column ids for `-header-<columnId>` are the `accessorKey` (`lastName`, `mrn`, `dob`, `npi`,
`specialty`, `displayName`, `role`, `organizationId`, `name`, `type`, `createDate`, `channel`,
`status`, `createdAt`, `sentAt`, `deliveredAt`, `lastLogin`) or the explicit `id` (`actions`,
`departments`).

Convention: kebab-case `<feature>-<element>[-<qualifier>]`; row/action ids carry the **entity id only**
(never a name, MRN, phone or other PHI). `hca34Id` on directory hits is an employee id, not PHI.

---

## Known gaps / open bugs

- **system_admin cannot create patients or providers from the UI** — `400 "organizationId is required for system admins."` toast; no org field on either form. [tasks/15](tasks/15-system-admin-org-picker-for-create.md).
- No automated tests yet — [tasks/12](tasks/12-frontend-unit-tests.md) adds Vitest + Playwright against the ids in this guide.
- `pnpm lint` does not pass on `main` (mobile `expo lint` self-installs and fails) — [tasks/17](tasks/17-lint-toolchain.md).
