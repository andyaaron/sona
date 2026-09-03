# Handoff — Connecting `sona.server` to the Opie ODBC Database

**Date:** 2026-09-03
**Status:** Read path + dashboard table implemented (branch `orthotic-clinic-integration`, 2026-09-03);
awaiting real `OpieConnection` credentials for an end-to-end run against `Opie_data`. See §8.
**Owner of this doc:** update in place as decisions are made; promote to `docs/architecture.md` /
`docs/data-model.md` once the integration ships (per AGENTS.md — docs are living, update in the
same task as the code).

---

## 1. What this is

`Opie_data` is an external practice-management database (confirmed to be **SQL Server** — reachable
via SQL Server Object Explorer once a DSN/connection is set up, not a "true" ODBC-only engine) that
Sona does **not** own. It holds patient demographics, phone numbers, and schedule/appointment data
from the source system ("Opie"). This doc hands off the work of pulling read-only data from three
of its tables into `apps/sona.server` so it can be joined against (or used to enrich/import) Sona's
own `Patients` table.

This is **read-only, cross-database integration** — conceptually the same shape as the planned
Cerner integration in `docs/data-model.md` (`Encounter`, Enhancement 1), not a replacement for
Sona's own SQL Server database or EF Core model. `Opie_data` is a second data source Sona's backend
reads from; it must never become the system of record for anything Sona already owns.

## 2. Source tables & columns needed

All three tables relate on `fldPatientID` (the patient's key in Opie's schema — **do not confuse
with Sona's own `Patient.Id`**; these are two different identity spaces until a mapping/matching
step exists — see [§6 Open questions](#6-open-questions)).

| Table | Join | Columns needed |
|---|---|---|
| `tblPatients` | (root — `fldPatientID` is its PK) | `fldPatientLastName`, `fldPatientFirstName`, `fldPatientMiddleName`, `fldPatientEmailAddress`, `fldPatientComment`, `fldPatientPrimaryPractitioner`, `fldPatientNickName`, `fldcmbLanguagePref` |
| `tblPatientSchedule` | `fldPatientSchedulePatientID → tblPatients.fldPatientID` | `fldPatientScheduleStartTime`, `fldPatientScheduleEndTime` |
| `tblPatientPhoneNumbers` | `fldPatientPhoneNumberPatientID → tblPatients.fldPatientID` | `fldPatientPhoneNumber`, `fldPatientPhoneNumberExtension`, `fldPatientPhoneNumberCountry` |

Base shape of the query that satisfies all three (adjust the `WHERE` to whatever the actual
selection criteria end up being — e.g. today's schedule, a specific patient id):

```sql
SELECT
    p.fldPatientID,
    p.fldPatientLastName,
    p.fldPatientFirstName,
    p.fldPatientMiddleName,
    p.fldPatientNickName,
    p.fldPatientEmailAddress,
    p.fldPatientComment,
    p.fldPatientPrimaryPractitioner,
    p.fldcmbLanguagePref,
    s.fldPatientScheduleStartTime,
    s.fldPatientScheduleEndTime,
    ph.fldPatientPhoneNumber,
    ph.fldPatientPhoneNumberExtension,
    ph.fldPatientPhoneNumberCountry
FROM dbo.tblPatients p
LEFT JOIN dbo.tblPatientSchedule s
    ON s.fldPatientSchedulePatientID = p.fldPatientID
LEFT JOIN dbo.tblPatientPhoneNumbers ph
    ON ph.fldPatientPhoneNumberPatientID = p.fldPatientID
WHERE CAST(s.fldPatientScheduleStartTime AS DATE) = @scheduleDate;
```

Notes:
- A patient can have **multiple phone numbers** and **multiple schedule rows** — this join fans out
  (one row per phone × per appointment). If the consumer needs "one patient, N phones, N
  appointments" shape, group in the application layer rather than in SQL, or issue three separate
  queries keyed by `fldPatientID` and assemble in code. Prefer the latter — it's simpler to reason
  about and avoids duplicate patient demographic data being pulled N×M times.
- `LEFT JOIN` (not `INNER`) so a patient with no phone on file or no schedule row still returns.

## 3. ⚠️ Compliance / PHI — read before writing any code

Per `AGENTS.md` Golden Rule 1 and `docs/compliance.md`, **none of this data may ever reach a
notification payload, log line, or URL.** Specific flags for these columns:

- `fldPatientComment` — free-text, almost certainly contains clinical notes. Treat as **high-risk
  PHI**. Do not log it, do not surface it anywhere outside an authenticated, role-gated internal
  view (if it's even needed — confirm why it's in scope before piping it anywhere).
- `fldPatientEmailAddress`, `fldPatientPhoneNumber*`, names, `fldPatientPrimaryPractitioner` — all
  PHI/identifiers. Fine at rest in an encrypted database; never in a message, a URL query string,
  or an unstructured log statement (structured logging with the value omitted/redacted is fine for
  operational diagnostics, e.g. log "phone lookup succeeded for patient {PatientId}", not the
  number itself).
- Appointment start/end times are PHI when tied to an identified patient (reveals a clinical
  encounter occurred). Same rule — internal use only, never in a template-gated outbound message.
- If this data is ever used to *drive* a notification (e.g. "notify patients with today's Opie
  appointment"), the notification content itself must still be the existing generic template — the
  Opie data can decide *who/when* to notify, never *what* to say.

## 4. Connectivity approach

### 4.1 Driver choice: use `Microsoft.Data.SqlClient`, not a generic ODBC driver

Since `Opie_data` is confirmed SQL Server, connect the same way `sona.server` already connects to
its own database — **`Microsoft.Data.SqlClient`** (already a transitive dependency via
`Microsoft.EntityFrameworkCore.SqlServer`) — not `System.Data.Odbc`. Reasons:

- One driver/connection stack in the codebase instead of two.
- Native SQL Server connection strings support integrated features (connection pooling, retry
  policy, `Encrypt=True`) that generic ODBC DSNs handle less predictably.
- The VS "ODBC" DSN you set up was just how you *explored* the schema in Server Explorer — the
  app itself doesn't need to go through ODBC at all if the target is genuinely SQL Server.

Only fall back to `System.Data.Odbc` if it turns out `Opie_data` is fronted by something that
*isn't* actually SQL Server in other environments (e.g. a different Opie deployment on a non-SQL
engine) — confirm this isn't the case before building anything, since it changes the whole approach.

### 4.2 Read model: **do not** add `Opie_data` tables to `ApplicationDbContext`

Keep this fully separate from Sona's own EF Core model and migrations:

- `ApplicationDbContext` and its migrations own Sona's schema only. `Opie_data` is a foreign,
  read-only system Sona doesn't control the shape of (it can change without Sona's knowledge).
- Recommended: a small **second, read-only EF Core `DbContext`** (e.g. `OpieDbContext` in
  `Data/External/OpieDbContext.cs`) mapped only to the three tables/columns above via
  `.ToTable(...).HasNoKey()` / explicit `OnModelCreating` config, **no migrations** (`Opie_data`'s
  schema isn't ours to migrate). Register it with `AsNoTracking()` as the default query behavior.
  - Alternative if EF feels heavy for three flat queries: `Dapper` or raw
    `Microsoft.Data.SqlClient` + `SqlDataReader` in a small repository class. Either is acceptable;
    pick whichever the team is more comfortable maintaining. Do not use EF's change tracking or
    `SaveChanges` against this database under any circumstance — it is not ours to write to.
- New read DTOs, not `packages/shared` types — these are internal-only shapes describing Opie's
  schema, not Sona's API contract. If/when this data needs to reach the admin client, map it onto
  Sona's existing `Patient`/`ReadyNotification` contract at the controller boundary (per AGENTS.md
  Rule 2, `packages/shared` stays the one API contract) rather than inventing a parallel one.

### 4.3 Configuration — new connection string, same secrets pattern as `DefaultConnection`

Add a second connection string key, e.g. `ConnectionStrings:OpieConnection`, following the existing
per-environment pattern in `docs/getting-started.md`:

| Environment | Where it comes from |
|---|---|
| `Local` | `ConnectionStrings:OpieConnection` in git-ignored `appsettings.Local.json` (add a line to `appsettings.Local.example.json` as a placeholder, same as `DefaultConnection`) |
| `Development` / `Production` | A **new** Key Vault secret (e.g. `OpieConnection`), fetched the same way `DefaultConnection` is today — do not hardcode or commit real Opie server/credentials anywhere |

Example addition to `appsettings.Local.example.json`:

```jsonc
"ConnectionStrings": {
  "DefaultConnection": "...",
  // Opie_data (read-only external source) — never commit real values to appsettings.Local.json:
  "OpieConnection": "Server=<opie-host>;Database=Opie_data;User Id=<readonly-user>;Password=<...>;Encrypt=True;TrustServerCertificate=True;"
}
```

**Use a read-only SQL login for `OpieConnection`** if Opie's DBA can provision one — Sona's backend
has no business writing to this database, and a read-only credential is a cheap safety net against
an accidental write path being added later.

## 5. Suggested implementation shape (for whoever picks this up)

1. `packages/shared` is **not** touched by this task unless/until Opie data is actually exposed
   through a Sona API endpoint — start with the read path landing only in `sona.server`.
2. `apps/sona.server/Data/External/OpieDbContext.cs` (or `Repositories/OpieScheduleRepository.cs`
   if going the Dapper/raw-ADO route) — read-only, `HasNoKey()` entities or POCOs matching §2.
3. Config: `OpieConnection` wired the same way `DefaultConnection` is in `Program.cs`
   (Key Vault for `Development`/`Production`, `appsettings.Local.json` for `Local` — mirror the
   existing `DefaultConnection` startup guard that refuses an Azure connection string in `Local`
   mode, adapted as appropriate; Opie's connection is a separate external server either way, so
   confirm with whoever owns `Opie_data` access whether the same environment split even applies).
4. A thin internal service/repository exposing typed read methods, e.g.
   `GetPatientWithScheduleAndPhonesAsync(int fldPatientID, DateOnly date)` — assemble the
   patient/phones/schedule shape in code (§2 fan-out note) rather than returning the raw joined
   rows.
5. No controller/endpoint yet unless the task explicitly calls for exposing this — confirm the
   actual consumer (is this for patient matching during import? for driving notification timing?)
   before deciding what, if anything, gets exposed through the API.

## 6. Open questions (resolve before/while implementing)

- **What is this data actually for?** The task list doesn't yet say whether this is (a) a one-time
  or periodic patient import/matching source, (b) a live lookup at notification-send time to know
  *when* a patient is scheduled, or (c) something else. This changes whether a background
  sync/import job, an on-demand query, or both are needed.
- **Identity matching:** `fldPatientID` is Opie's key, not Sona's `Patient.Id`. If this feeds
  Sona's own `Patients` table, a matching strategy is needed (MRN? name+DOB? a new
  `Patient.OpiePatientId` column?) — same shape problem as `Encounter.Fin` in `docs/data-model.md`.
- **BAA / data-sharing agreement** for the Opie system — confirm this is already covered under
  existing agreements before any production data flows (compliance review, not a code question —
  same category as the Webex Connect BAA gap noted in `docs/compliance.md`).
- **Read-only credential availability** — confirm with Opie's DBA/vendor whether a scoped
  read-only SQL login can be issued, vs. only the ODBC-explored admin-ish credential used so far.
- **Refresh cadence** — is a live query per request acceptable, or does `Opie_data` need to be
  polled/cached (e.g. nightly sync) for performance/load reasons on the source system?

## 7. Verification (once implemented)

- `dotnet build Sona.slnx` passes.
- No new EF migration is generated for `Opie_data` tables (confirms the read-only `DbContext` has
  no `DbSet` mutations / isn't part of `ApplicationDbContext`'s model).
- Manual query against a real `Opie_data` connection returns expected rows for a known
  `fldPatientID` / date (see the earlier SQL in [§2](#2-source-tables--columns-needed) for a
  hand-run sanity check via SSMS before trusting the code path).
- No PHI (patient name, phone, comment, email) appears in any log output — grep `Serilog` output
  during a manual test run to confirm.

---

## 8. As implemented (2026-09-03)

Deviations from §4–§5 and the reasons:

| Area | Decision |
|---|---|
| Driver | `Microsoft.Data.SqlClient` + `SqlDataReader` in `apps/sona.server/Models/Opie/OpieScheduleRepository.cs` — **not** a second EF `DbContext`: with two contexts every `dotnet ef` command in `docs/getting-started.md` would need `--context`, and Opie's schema is not ours to model or migrate. Read-only by construction (no write path). |
| Query shape | Three parameterised queries per request (schedule rows, phone rows, patient rows), all filtered by `CAST(fldPatientScheduleStartTime AS DATE) = @date`, assembled in code into one `OpieScheduledPatient` per patient with `appointments[]` + `phoneNumbers[]` (the §2 fan-out advice). |
| Column types | Unknown, so readers are type-agnostic (`fldPatientID` round-trips as a trimmed string; datetimes as ISO `"O"`). Revisit once a real connection confirms the types. |
| Config | `ConnectionStrings:OpieConnection` — Local: `appsettings.Local.json` (placeholder in `appsettings.Local.example.json`); Dev/Prod: Key Vault secret `OpieConnection`, 404 tolerated. Missing → `IOpieScheduleRepository.IsConfigured == false`, API still starts. |
| Endpoint | `GET /api/opie/schedule?date=YYYY-MM-DD` (`OpieController`, policy `AssignedUser`, default = server's today). `400` bad date · `503 opie-not-configured` · `502 opie-unavailable` (SqlException etc., logged with date only). Not tenant-scoped — Opie has no org concept (open question for §6). |
| Contract | Exposed through the API, so per AGENTS.md Rule 2 the shapes live in `packages/shared` (`OpieScheduledPatient`, `OpieAppointment`, `OpiePhoneNumber`, `opieScheduleQuerySchema`) and `packages/api-client` (`opieApi.schedule`). Kept as their own types, not folded into `Patient` — no identity mapping exists yet. |
| Consumer | Admin dashboard `/` → **Opie Schedule** table with a date picker (`apps/sona.client/src/features/opie-schedule/`). Display only; `fldPatientComment` is shown truncated with hover — confirm it should be on screen at all (§3). Layout/testids in `docs/admin-ui-guide.md`. |
| Logging | Counts + date only (`"Opie schedule for {ScheduleDate}: {PatientCount} patients"`); exceptions carry server/login details, never row data. |

Still open from §6: purpose beyond display, `fldPatientID` ↔ `Patient.Id` matching, BAA coverage, read-only login, refresh cadence (currently a live query per page load, cached by TanStack Query per date).

Verification checklist for the first real run: fill `OpieConnection` in `appsettings.Local.json`, restart the API, open `/`, pick a date with known appointments, compare against the §2 SQL in SSMS, and grep the console log for any name/phone/email/comment (there must be none).

---

## 9. Dashboard schedule layout redesign (proposed, not yet implemented — 2026-09-03)

**Problem:** the current dashboard renders the Opie schedule as a patient-per-row table
(`OpieScheduleTable`, one row per `OpieScheduledPatient` with a nested list of appointments). This
was raised for discussion because a table organized by patient doesn't read like a clinic's daily
schedule — the ask is a time-oriented view: from start of day to end of day, each slot either open
or booked.

### 9.1 Data constraints found while scoping this

- `OpieAppointment` (`packages/shared/src/types.ts`) is only `{ startTime, endTime }` — Opie's
  source data (§2) is a list of *booked* appointments; there is no concept of clinic operating
  hours or empty slots anywhere upstream. "Open" cannot be fetched — it can only be *derived* from
  gaps between known appointments.
- No slot-duration/interval config exists anywhere (not in `packages/shared`, not in Opie). A fixed
  grid ("every row = one 15-min slot") would require inventing new configuration (clinic
  open/close time + interval, presumably per department) — a contract change, not a display change.
- `primaryPractitioner` is a field on the *patient*, not on the individual appointment — it's the
  patient's primary practitioner generally, not necessarily confirmed as who a given appointment
  slot is with.
- No appointment type, room, resource, or status field is available.
- The `/api/opie/schedule` endpoint is not tenant/department-scoped (Opie has no org concept — an
  existing open question, see §6).

### 9.2 Options considered

1. **Sorted agenda list** — flatten to one row per appointment, sorted chronologically. No new
   backend data or contract change; ships entirely client-side.
2. **Fixed time-grid** (e.g. rows every 15 min from open to close, booked appointments span their
   duration, empty rows = open) — most literal match to the original ask, but needs new
   clinic-hours/interval configuration that doesn't exist today (contract change).
3. **Calendar day view with provider columns** (swimlanes, like a typical scheduling UI) — same
   grid idea as (2) but with a column per practitioner, needed once more than one practitioner can
   have concurrent appointments (a single-lane grid can't represent two patients booked at the same
   time with different providers).

### 9.3 Decision (pending review)

Clarified with the requester:
- Multiple practitioners **can** run concurrent appointments on the same day.
- "Open" only needs to mean a visual gap between known appointments — not a true bookable slot
  validated against clinic hours.
- Scope for now: start small (option 1, agenda), not the full grid (option 2/3).

**Proposed design:** a *per-practitioner* agenda, not one flat clinic-wide list — a single sorted
list would compute gaps that are misleading once providers overlap (e.g. Dr. A idle 10:00–10:30
while Dr. B is booked would still show as clinic-wide "open," which is wrong).

- Group appointments by `primaryPractitioner`; one section (or column, if width allows) per
  provider. Patients with no `primaryPractitioner` get their own "Unassigned" section so nothing
  silently disappears.
- Within each provider's section, flatten patient → appointment (a patient can have more than one
  appointment/day per `OpieAppointment[]`) and sort by `startTime` — not grouped by patient like
  the current table.
- Between consecutive appointments in the same provider's list, if the gap exceeds a small
  threshold (e.g. 10 min), render a lightweight "— 25 min open —" divider row. Purely derived from
  existing `startTime`/`endTime`; no new data.
- Patient identity fields (name, phone, comment, etc.) stay exactly as today — same PHI handling,
  same truncate/hover convention for `comment`, same `data-testid` conventions to update in
  `docs/admin-ui-guide.md` alongside the implementation.
- Fits entirely within `apps/sona.client/src/features/opie-schedule/` — no `packages/shared` or
  `apps/sona.server` changes required for this iteration. Options 2/3 (true time-grid, provider
  swimlanes with clinic-hours config) remain open as a possible follow-up if the agenda view proves
  insufficient.
