# Task 22 Handoff — Remove `StampEntityBaseTimestamps` / `CreateDate` / `ModDate`

Completed 2026-09-08. Source prompt: `docs/tasks/22-remove-stampentitybasetimestamps.md`.

## Summary

`StampEntityBaseTimestamps()` and the `CreateDate`/`ModDate` columns it maintained on
`EntityBase`-derived tables have been removed. The `[Auditable]`-attribute-driven audit log
(`AuditLogs` table, `OnBeforeSaveChanges`/`OnAfterSaveChanges` in `ApplicationDbContext`) is now
the single mechanism for tracking record changes, as decided in the task prompt.

## Decision: remove, with one exception

- **Removed entirely** from `EntityBase` and every entity that inherited the columns via it:
  `Organization`, `Site`, `Department`, `UserDepartmentAccess`, `Provider`, `MessageTemplate`,
  `ImportBatch`, `ImportRowError`.
- **Exception — `MessageOut` keeps a created timestamp**, but as its own field (`CreatedDate`),
  not via `EntityBase`. `MessageOut` rows *are* the compliance audit trail for sends, and the
  admin notification-history endpoint needs a created time even for consent-blocked attempts
  that never reach `SentDateTime`. The `[Auditable]` log doesn't cover this — it only records
  Modified/Deleted changes, not Added rows — so it can't substitute. `CreatedDate` is stamped
  once at construction (`= DateTime.UtcNow` in code; `SYSUTCDATETIME()` default in the DB) and
  never updated.

## Code changes

### Server (`apps/sona.server`)

- `Data/ApplicationDbContext.cs` — deleted `StampEntityBaseTimestamps()`, its call site, and the
  two dead commented-out `SaveChanges`/`SaveChangesAsync` override blocks (including the stray
  "Aaron will add this back" comment).
- `Data/EntityBase.cs` — removed `CreateDate`/`ModDate` properties; updated the class doc comment
  to point at the audit log instead.
- `Data/DbModels/Messaging/MessageOut.cs` — added `CreatedDate` (own property, documented inline
  with the rationale above).
- `Controllers/OrganizationsController.cs` — removed `CreateDate`/`ModDate` from
  `OrganizationResponseDto`, `SiteResponseDto`, `DepartmentResponseDto` and their mappings.
- `Controllers/ProvidersController.cs` — removed `CreateDate`/`ModDate` from
  `ProviderResponseDto` and its mapping.
- `Controllers/NotificationsController.cs` — `OrderByDescending(m => m.CreateDate)` →
  `OrderByDescending(m => m.CreatedDate)`; `CreatedAt` DTO field now sources
  `message.CreatedDate`.
- **Left untouched (confirmed out of scope):** `AppUser.ModDate`/`InDate` — `AppUser` does not
  inherit `EntityBase`; these are separate, pre-existing fields unrelated to this cleanup
  (`Models/Util/AppUserUtil.cs`, `Models/Local/LocalDevSupport.cs`, `Controllers/UsersController.cs`,
  `Controllers/LocalDevController.cs`).

### Migration

- `Data/Migrations/20260908190838_RemoveEntityBaseTimestamps.cs` (+ `.Designer.cs`,
  `ApplicationDbContextModelSnapshot.cs` updated) — drops `CreateDate`/`ModDate` from
  `UserDepartmentAccesses`, `Sites`, `Providers`, `Organizations`, `MessageTemplates`,
  `Departments`, and `MessagesOut`; adds `MessagesOut.CreatedDate` (`datetime2`, default
  `SYSUTCDATETIME()`) rather than renaming a column, since the new field has different semantics
  (stamped once, never updated) than the old `ModDate` it replaces.
- **Not applied against the Azure dev db** — generation only, per `docs/tasks/_context.md`
  (no reachable Azure credentials in this environment). Generated using a temporary, local-only
  `DesignTimeDbContextFactory` that was deleted again before finishing (per the same doc's
  warning that leaving it in place breaks `dotnet ef database update` against the real Azure
  connection string).

### Contract (`packages/shared` + `apps/sona.client`)

- `packages/shared/src/types.ts` — removed `createDate`/`modDate` from `Organization`, `Site`,
  `Department`, `Provider`.
- `apps/sona.client/src/routes/organizations/index.tsx` — removed the "Created" column
  (`accessorKey: 'createDate'`) from the organizations table.
- `apps/sona.client/src/testing/fixtures.ts` — removed `createDate`/`modDate` from
  `makeOrganization`/`makeSite`/`makeDepartment`/`makeProvider` fixtures.
- `packages/api-client` required no changes (no endpoint shape drift beyond the DTOs above).

### Docs

- `docs/data-model.md` — removed all `CreateDate`/`ModDate` rows from entity tables; updated the
  top-level conventions note to point at the audit log, with the `MessageOut.CreatedDate`
  exception called out explicitly.
- `docs/admin-ui-guide.md` — removed the "Created" column from the Organizations table region
  description and the `-header-createDate` testid; fixed the raw-SQL `UserDepartmentAccesses`
  insert example (no longer needs `CreateDate`/`ModDate` values).
- `docs/handoff.md` — updated the EF Core data layer summary to stop referencing
  auto-stamped `CreateDate`/`ModDate`.

## Verification performed

| Check | Result |
|---|---|
| `dotnet build apps/sona.server/sona.server.csproj` | ✅ Build succeeded, 0 errors (pre-existing warnings only) |
| `pnpm typecheck` (all 4 TS packages) | ✅ passed |
| `pnpm build` | ✅ passed |
| `pnpm test` (Vitest — `@sona/shared` 42 tests, `sona.client` 66 tests) | ✅ all passed |
| `dotnet ef migrations add RemoveEntityBaseTimestamps` | ✅ generated (not applied — Azure dev db unreachable) |

Not run: `pnpm e2e` (no user-visible flow changed beyond removing one non-interactive table
column, which is covered by the existing organizations Vitest/route coverage) and a Local-profile
manual UI pass — the only observable change is the removed "Created" column on `/organizations`,
which is a straightforward column drop with no new interaction to exercise.

## Follow-ups for whoever applies this migration

- The Azure dev db needs a human to run `dotnet ef database update` (or apply the migration
  through the usual pipeline) since this environment couldn't reach it.
- No other action needed — all consumers were updated in this same change per `AGENTS.md` §2.
