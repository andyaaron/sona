# Task 00 — Fix the EF migration baseline

**Prerequisite for any task that adds a migration (02, 03, 05). Do this first.**
Read `docs/tasks/_context.md` and `AGENTS.md` before touching anything.

## Problem

`apps/sona.server/Data/Migrations/20260811191806_InitialCreate.cs` has an **empty `Up()`/`Down()`**, while `ApplicationDbContextModelSnapshot.cs` and the later `20260820194331_UniqueMrnIndex` migration assume `AccessLevels`/`AppLogs`/`AppUsers`/`Patients` already exist (they were evidently created out-of-band on the Azure dev db). Consequence: `dotnet ef database update` against a fresh database creates almost nothing and then fails — no environment can be rebuilt from the committed migrations.

## Requirements

1. Rebuild the baseline: delete all files in `Data/Migrations/` (InitialCreate, serilog, UniqueMrnIndex, Designer files, snapshot) and generate one fresh migration (`dotnet ef migrations add InitialCreate --project apps/sona.server`) capturing the FULL current model — all four tables including the serilog `AppLogs` shape and the unique `Patient.Mrn` index. Make no entity/model changes in this task; the migration must be a faithful snapshot of what's in `Data/DbModels/` today.
2. Open the generated file and verify `Up()` actually creates all four tables + the unique MRN index — do not trust exit codes.
3. The Azure dev db already has these tables plus rows in `__EFMigrationsHistory` naming the old migrations. Reconciliation (either dropping/recreating the dev db, or manually rewriting its `__EFMigrationsHistory` to the new baseline id) requires db access you likely don't have — document the exact reconciliation steps in `docs/getting-started.md` and state clearly in your report that it must be run by a human.
4. Sanity: `dotnet build Sona.slnx` passes; if a local SQL Server is available (docker), prove the baseline by running `dotnet ef database update` against an empty local db and say so; otherwise report build-only verification.

## Out of scope

Any entity change, any new table, seeding data, touching the dev connection string.

## Definition of Done

Per `_context.md` §Definition of Done, plus §2 and §3 above.
