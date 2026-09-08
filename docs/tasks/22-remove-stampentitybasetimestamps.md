# Task 22 — Remove `StampEntityBaseTimestamps` from `ApplicationDbContext`

**Priority: high** — touches every write path through `ApplicationDbContext`; also fixes a live
bug (see §2) that should not sit unaddressed if this code is being touched anyway.

**Status: done 2026-09-08** — see `docs/task-22-handoff.md` (including the audit corrections at the bottom).

Read `docs/tasks/_context.md` and `AGENTS.md` first.

## Background

`apps/sona.server/Data/ApplicationDbContext.cs` has two independent audit/timestamp mechanisms
living side by side:

1. **`StampEntityBaseTimestamps()`** (private method, ~line 176) — sets `CreateDate`/`ModDate`
   (UTC) on any entity inheriting `EntityBase` (`Data/EntityBase.cs`) when it is Added/Modified.
   This predates the audit log work.
2. **The `[Auditable]`-attribute-driven audit log** (`OnBeforeSaveChanges` / `OnAfterSaveChanges`,
   writing to the `AuditLogs` table) — added more recently, records field-level old/new value
   history keyed by entity name + primary key + changed-by user, for any entity type decorated
   with `[Auditable]`.

Decision: **we are standardizing on the `[Auditable]` audit log as the single mechanism for
tracking record changes in this app, and removing `StampEntityBaseTimestamps` and the
`CreateDate`/`ModDate` columns/usage it maintains.** This task is the implementation of that
decision — do not re-litigate whether to remove it; the job is to remove it correctly and account
for every current consumer.

## What `StampEntityBaseTimestamps` currently affects (found during investigation — verify this
list against the current code, it may have grown)

- Called from the sync `SaveChanges(bool acceptAllChangesOnSuccess)` override only.
- **Bug, current state:** it is *not* called from the async
  `SaveChangesAsync(bool, CancellationToken)` override — that override only runs the audit-log
  logic. So today, `CreateDate`/`ModDate` are already silently **not** stamped on the (more
  common) async save path, while `IEntityTypeConfiguration`/EF column definitions and API DTOs
  still assume they're populated. This drifted during a merge — there are two commented-out
  duplicate `SaveChanges`/`SaveChangesAsync` override blocks left above the real ones (one with a
  stray comment: "Aaron will add this StampEntityBaseTimestamps(); piece back into the lower area
  - FJC 9/4/26") that should be deleted regardless of the outcome here — dead code either way.
- `EntityBase` (`Data/EntityBase.cs`) declares `CreateDate`/`ModDate` — inherited by every
  new-style entity: `Provider`, `Organization`, `Site`, `Department`, `UserDepartmentAccess`,
  `MessageOut`, `MessageTemplate`, `ImportBatch`, `ImportRowError`.
- **Read/consumed elsewhere, not just written:**
  - `Controllers/OrganizationsController.cs` — serializes `CreateDate`/`ModDate` (as ISO strings)
    into the `Organization`, `Site`, and `Department` response DTOs.
  - `Controllers/ProvidersController.cs` — serializes `CreateDate`/`ModDate` into the provider
    response DTO.
  - `Controllers/NotificationsController.cs` — orders notification history with
    `.OrderByDescending(m => m.CreateDate)`.
  - `Models/Util/AppUserUtil.cs`, `Models/Local/LocalDevSupport.cs`, `Controllers/UsersController.cs`,
    `Controllers/LocalDevController.cs` — set `ModDate` directly on `AppUser` in a few places
    (`AppUser` does **not** inherit `EntityBase` — it declares its own `ModDate` property
    independently; confirm whether `AppUser.ModDate` is in scope for this removal or is a
    separate, unrelated field before touching it).
  - EF migrations (`Data/Migrations/*.cs`, `ApplicationDbContextModelSnapshot.cs`) define
    `CreateDate`/`ModDate` columns for every `EntityBase`-derived table.
- Client-side: confirm whether `apps/sona.client` reads/displays `createDate`/`modDate` anywhere
  (`OrganizationsController`/`ProvidersController` DTOs expose them — grep the client for
  `CreateDate`/`ModDate`/`createDate`/`modDate` consumption before deciding whether the contract
  in `packages/shared` needs a matching change).

## Goal

Remove `StampEntityBaseTimestamps` and stop relying on `CreateDate`/`ModDate` for change
tracking, without breaking anything that currently reads those fields — either by removing the
fields cleanly end-to-end, or by explicitly deciding (and stating in the report) that a given
consumer should be re-pointed at the audit log / another timestamp source instead.

## Requirements

1. **Delete `StampEntityBaseTimestamps`** and both calls to it in `ApplicationDbContext.cs`.
   Delete the two dead, commented-out `SaveChanges`/`SaveChangesAsync` override blocks above the
   real ones while in this file (unrelated dead code, but trivial to clean up here).
2. **Decide and implement the fate of `CreateDate`/`ModDate` end-to-end** — do not leave the
   columns in place silently unpopulated (worse than removing them: `Organization`/`Provider`
   DTOs would start serializing `0001-01-01` once stamping stops). Two acceptable outcomes, pick
   one per consumer and justify it in the report:
   - **Remove the fields** from `EntityBase`, every entity's mapped columns, the DTOs above, the
     `OrderByDescending` in `NotificationsController` (replace with an appropriate substitute,
     e.g. an audit-log-derived created time, or drop the ordering requirement if no longer
     meaningful), and generate the corresponding EF migration dropping the columns; or
   - **Keep the fields but repoint their population** at something else appropriate (e.g. have
     the audit log's own `ChangedDate`/insert path stamp a created timestamp if one is still
     needed for display/sort purposes) — only choose this if removing the columns would break a
     requirement elsewhere (e.g. compliance needs a queryable created-date without joining audit
     log rows). State explicitly which you chose and why.
3. **`AppUser.ModDate`** — confirm independently (it does not inherit `EntityBase`) whether it's
   in scope. If it's unrelated to this cleanup (used for a different purpose than
   `EntityBase.ModDate`), leave it untouched and say so explicitly in the report.
4. **Migration:** if columns are dropped, generate the EF migration
   (`dotnet ef migrations add RemoveEntityBaseTimestamps --project apps/sona.server`) per the
   usual constraints in `docs/tasks/_context.md` (Azure dev db likely unreachable — generating
   the migration is sufficient, say so).
5. **Contract:** if any client-facing DTO shape changes (removing `createDate`/`modDate` fields),
   update `packages/shared` + `packages/api-client` + all `apps/sona.client` consumers in the same
   task per `AGENTS.md` §2.
6. **Docs:** update `docs/data-model.md` if `EntityBase`'s shape changes; update
   `docs/admin-ui-guide.md` if any admin-visible created/modified date disappears from a page.

## Out of scope

- Any change to the `[Auditable]` attribute audit log mechanism itself (`OnBeforeSaveChanges`,
  `OnAfterSaveChanges`, `AuditLog` entity) — it is correct as-is and is the system we're
  standardizing on.
- Adding `[Auditable]` to entities that don't already have it.

## Definition of Done

Per `docs/tasks/_context.md` + `AGENTS.md` §4, plus:

- [ ] `StampEntityBaseTimestamps` and its call sites are gone; the two dead commented-out
      override blocks are gone.
- [ ] Every current reader of `CreateDate`/`ModDate` (listed in Background) has been explicitly
      addressed — updated or confirmed unaffected — not silently left reading a now-unpopulated
      field.
- [ ] `dotnet build apps/sona.server/sona.server.csproj` passes.
- [ ] `pnpm typecheck` / `pnpm build` pass if any client-facing contract or DTO changed.
- [ ] EF migration generated if columns changed, per constraints above.
- [ ] Report states explicitly: which outcome (remove vs. repoint) was chosen for
      `CreateDate`/`ModDate`, what was done with `AppUser.ModDate`, and how the
      `NotificationsController` ordering was resolved.
