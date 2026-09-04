# Task 28 — Message templates: create, approve, retire (new admin page)

**Status: proposed 2026-09-04.** Several product decisions are open (Q28.1–Q28.4) — they
change the data model, so settle them before starting.
**Depends on:** nothing shipped. Task 25 (placeholders) and the v2 paperwork reminder
(`_backlog.md`) build on it, so the template model here must anticipate placeholders and
multiple template kinds even if v1 ships neither.

Read `docs/tasks/_context.md`, `AGENTS.md`, `docs/compliance.md`, `docs/data-model.md`
(MessageTemplate), `docs/admin-ui-guide.md` (`/user-management` and `/organization` are the
reference admin pages — match their layout, role gates and testid style) and
`features/user-management` (reference feature for list + form + role-gated actions) first.

## Ask (colleague feedback, 2026-09-04)

> Setup message templates UI. You can create them, they need approval. We need to figure out how
> this will work. Do we want staff to be able to create templates, and then organization admin
> approves? This will require a new UI and page to handle this.

## Today

`MessageTemplates` = `{ Key, Body, IsActive }` (`Data/DbModels/Messaging/MessageTemplate.cs`),
global (no org), one row seeded (`ready-to-be-seen`, "You're ready to be seen. Please come to the
front desk."). Both send paths pick `Key == 'ready-to-be-seen' && IsActive`; there is no UI, no
approval, no history. `MessageOut.MessageTemplateId` + `Body` snapshot the template used.
`docs/compliance.md` calls the template table "the PHI review gate: content is reviewed once here".
This task is that review gate becoming real.

## Proposed model

`MessageTemplate` gains (migration `MessageTemplateApproval`, `docs/data-model.md` updated):

| Column | Type | Notes |
|---|---|---|
| `OrganizationId` | Guid? FK | null = system template visible to every org (the seeded one). Org templates belong to one org. Q28.2 |
| `Name` | string(100) | human label ("Ready — front desk") |
| `Kind` | string | `ready-to-be-seen` today; `appointment-reminder`, `new-patient-paperwork` later. Replaces the `Key` uniqueness: many templates per kind, **at most one `approved` + `IsActive` per (org, kind)** — the one sends use |
| `Status` | string | `draft` → `pending_approval` → `approved` \| `rejected`; `approved` → `retired`. Q28.1 |
| `CreatedByUserId` | int FK | |
| `SubmittedDateTime`, `ReviewedByUserId`, `ReviewedDateTime`, `ReviewNote` | | review audit; `ReviewNote` is reviewer text only (why rejected), never patient content |
| `Body` | string(320) | max two SMS segments; placeholders per whitelist (Task 25) — v1 whitelist is empty, so the body is literal text |

`Key` is kept as the resolver used by the send paths: resolve `(org, kind)` → approved active
template, falling back to the system template of that kind. `IsActive` keeps its meaning
(retire without breaking `MessageOut` references). Editing an approved template is not allowed —
"Duplicate" creates a new draft (immutability keeps `MessageOut.Body` snapshots honest).

## Roles (proposal — Q28.1)

| Action | Who |
|---|---|
| View list, view a template | `AssignedUser` of the org (+ system_admin) |
| Create draft, edit own draft, submit for approval, delete own draft | `AssignedUser` |
| Approve / reject (with note), retire | `OrgAdmin` of that org; `SystemAdmin` anywhere. An org_admin may **not** approve a template they authored (Q28.3) |
| Create/approve system templates (org = null) | `SystemAdmin` only |

## API (`MessageTemplatesController`, policy per row above)

`GET /api/message-templates?organizationId=&kind=&status=` · `GET /{id}` · `POST` (draft) ·
`PUT /{id}` (draft only) · `POST /{id}/submit` · `POST /{id}/approve` · `POST /{id}/reject
{note}` · `POST /{id}/retire` · `DELETE /{id}` (draft only, hard delete acceptable — never sent).
Approving sets the previous approved template of that (org, kind) to `retired` in the same
transaction. Contract in `packages/shared` (`MessageTemplate` type, `MessageTemplateStatus`,
`MessageTemplateKind` unions, `createMessageTemplateSchema`, `reviewMessageTemplateSchema`) +
`packages/api-client` `messageTemplatesApi`.

## UI — new route `/message-templates`

- **Nav:** header link "Message templates" (`header-nav-message-templates`) for `AssignedUser`+,
  placed after Providers.
- **List** (`message-templates-table`, shared `Table`): Name · Kind · Status pill
  (`message-template-status-<id>`) · Author · Updated · actions. Filter chips by status
  (`message-templates-filter-<status>`); org_admin sees a "Pending approval (N)" chip first.
  Empty state "No message templates yet."
- **Create / edit** (`/message-templates/new`, `/message-templates/$id/edit` — drafts only):
  Name, Kind (select), Body textarea with live character/segment count
  (`message-template-form-body-count`, "42 / 160 · 1 segment"), a **preview** panel rendering the
  body exactly as it will be sent (`message-template-preview`), and a fixed reminder line above
  the field: "No patient names, conditions, appointment reasons or specialties — see
  compliance.md" (`message-template-form-phi-notice`). Validation from `createMessageTemplateSchema`
  (TanStack Form + `schema-validation.ts` adapter). Buttons: Save draft · Submit for approval.
- **Detail** (`/message-templates/$id`): read-only body + preview, status timeline (created,
  submitted, reviewed by/when, note), actions by role/state: Approve (`message-template-approve`,
  `ConfirmDialog` "Approve and make this the active {kind} template? The current one will be
  retired."), Reject (dialog with required note, `message-template-reject-note`), Retire,
  Duplicate, Delete draft.
- Toasts: "Template saved", "Submitted for approval", "Template approved", "Template rejected",
  "Template retired". Role gates enforced server-side; the UI hides what the role cannot do.

## Send-path change

`NotificationsController.GetActiveReadyTemplateAsync` → `IMessageTemplateResolver.Resolve(orgId,
kind)`; both notify paths use it. If no approved template resolves → `500 no-active-template`
as today. Seed migration: the existing row becomes `Kind = ready-to-be-seen, Status = approved,
OrganizationId = null, Name = "Ready to be seen (default)"`.

## Tests (same task)

Shared: schema tests (body length, kind/status enums). Client: list filters, form validation +
segment count, role-gated actions (renderWithProviders as assigned / org_admin / system_admin),
approve dialog. e2e (`@smoke`): assigned user creates + submits → switch role (roles fixture) to
org_admin → approve → previous template shows retired → a notify send's `body` equals the new
text. Server: resolver picks org template over system template; approve retires the previous one
atomically.

## Docs (same commit)

Guide: new page section (regions, click paths, toasts, role gates, testids) + header nav;
`docs/data-model.md`; `docs/compliance.md` "Notification templates reviewed" checklist item →
describe the approval gate; `docs/architecture.md` if the notification flow diagram mentions
templates. Verify in the running app and quote what was observed.

## Non-goals

- No placeholders in v1 (Task 25 adds the whitelist + renderer).
- No scheduled/automatic sends (backlog).
- No per-template channel (SMS only today).

## Open questions (answer by number)

- **Q28.1 (blocking)** Confirm the workflow: any assigned staff drafts → org_admin approves
  (proposed). Alternatives: only org_admin drafts and system_admin approves; or org_admin drafts
  and self-approves with an audit trail. Who is the compliance reviewer in practice?
- **Q28.2 (blocking)** Org-scoped templates with a system-wide default (proposed), or one global
  set managed by system_admin only?
- **Q28.3** May an org_admin approve their own draft? Proposed: no (two-person rule) — but a
  one-admin clinic then needs system_admin. Acceptable?
- **Q28.4** Approving a new template of a kind automatically retires the current one (proposed),
  or can several approved templates coexist with the sender choosing in the dialog (Task 25
  Q25.4 leans this way)? If several, the list needs a "default" flag.
- **Q28.5** Should rejected/retired templates be listable forever (audit) or archived out of the
  default list after N days? Proposed: listable, hidden behind the status filter.
- **Q28.6** Max length: one SMS segment (160 GSM-7 chars) enforced, or allow two with a warning?
