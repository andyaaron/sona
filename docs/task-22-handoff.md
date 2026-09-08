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
- **Exception — `MessageOut` keeps `CreateDate`**, declared as its own property now that
  `EntityBase` no longer carries it. `MessageOut` rows *are* the compliance audit trail for
  sends, and the admin notification-history endpoint needs a created time even for
  consent-blocked attempts that never reach `SentDateTime`. The `[Auditable]` log doesn't cover
  this — it only records Modified/Deleted changes, not Added rows — so it can't substitute.
  `CreateDate` is stamped once at construction (`= DateTime.UtcNow`) and never updated. The
  column itself is untouched by the migration, so existing rows keep their values (the original
  commit renamed it to `CreatedDate` via drop + re-add, which would have reset every historical
  row to migration time — corrected in the 2026-09-08 audit, see bottom).

## Code changes

### Server (`apps/sona.server`)

- `Data/ApplicationDbContext.cs` — deleted `StampEntityBaseTimestamps()`, its call site, and the
  two dead commented-out `SaveChanges`/`SaveChangesAsync` override blocks (including the stray
  "Aaron will add this back" comment).
- `Data/EntityBase.cs` — removed `CreateDate`/`ModDate` properties; updated the class doc comment
  to point at the audit log instead.
- `Data/DbModels/Messaging/MessageOut.cs` — declares `CreateDate` itself (own property, same
  column name as before, documented inline with the rationale above).
- `Controllers/OrganizationsController.cs` — removed `CreateDate`/`ModDate` from
  `OrganizationResponseDto`, `SiteResponseDto`, `DepartmentResponseDto` and their mappings.
- `Controllers/ProvidersController.cs` — removed `CreateDate`/`ModDate` from
  `ProviderResponseDto` and its mapping.
- `Controllers/NotificationsController.cs` — unchanged in the end: still orders by
  `m.CreateDate` and sources the `CreatedAt` DTO field from `message.CreateDate`, now resolved
  against `MessageOut`'s own property.
- **Left untouched (confirmed out of scope):** `AppUser.ModDate`/`InDate` — `AppUser` does not
  inherit `EntityBase`; these are separate, pre-existing fields unrelated to this cleanup
  (`Models/Util/AppUserUtil.cs`, `Models/Local/LocalDevSupport.cs`, `Controllers/UsersController.cs`,
  `Controllers/LocalDevController.cs`).

### Migration

- `Data/Migrations/20260908190838_RemoveEntityBaseTimestamps.cs` (+ `.Designer.cs`,
  `ApplicationDbContextModelSnapshot.cs` updated) — drops `CreateDate`/`ModDate` from
  `UserDepartmentAccesses`, `Sites`, `Providers`, `Organizations`, `MessageTemplates`,
  and `Departments`; drops only `ModDate` from `MessagesOut` (its `CreateDate` column is left
  in place, values preserved).
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
  top-level conventions note to point at the audit log, with the `MessageOut.CreateDate`
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

Not run: `pnpm e2e` and a Local-profile manual UI pass. The only observable change is the
removed "Created" column on `/organizations`, a straightforward column drop with no new
interaction to exercise. Note there is **no** Vitest route test for `/organizations`
(`src/routes/organizations/` holds only `index.tsx`), and the `@smoke` spec never referenced the
`-header-createDate` testid, so this column's removal is covered by typecheck only.

## Audit corrections (2026-09-08)

Applied after review of commit `7cca81b`:

- **`MessagesOut.CreateDate` kept instead of renamed.** The commit dropped `CreateDate` and added
  `CreatedDate` with a `SYSUTCDATETIME()` default, which would have overwritten every existing
  send's created timestamp with the migration run time — on the one table that is the compliance
  record of when a patient was texted. Reverted to keeping `CreateDate` as `MessageOut`'s own
  property; migration now only drops `MessagesOut.ModDate`. Entity, controller, migration,
  Designer, snapshot and docs updated; `dotnet ef migrations has-pending-model-changes` reports
  the snapshot matches the model.
- **Model/DB drift removed.** The hand-added `defaultValueSql` on the new column had no matching
  `HasDefaultValueSql` in the snapshot; moot now that no column is added.
- **Known data gap, not fixed here:** `MessagesOut` rows written via `SaveChangesAsync` between
  the 2026-09-04 audit-log merge and this task hold `CreateDate = 0001-01-01` (the async path
  never called `StampEntityBaseTimestamps`). Whoever applies the migration can backfill with
  `UPDATE MessagesOut SET CreateDate = ISNULL(SentDateTime, SYSUTCDATETIME()) WHERE CreateDate = '0001-01-01'`.
- Task file status set to done; stale `CreateDate`/`ModDate` references in `docs/data-model.md`
  (Patient, AppUser, MessageIn, Encounter, Device tables), `docs/patient-tasks.md` (Provider),
  `docs/tasks/19-*.md` (Part C now superseded for `EntityBase` tables) and `docs/tasks/27-*.md`
  (`AppointmentVisits` shape) cleaned up.

## Follow-ups for whoever applies this migration

- The Azure dev db needs a human to run `dotnet ef database update` (or apply the migration
  through the usual pipeline) since this environment couldn't reach it.
- No other action needed — all consumers were updated in this same change per `AGENTS.md` §2.
