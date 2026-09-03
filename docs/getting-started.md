# Getting Started

## Prerequisites

| Tool | Required version | What it's for |
|------|-----------------|---------------|
| Node.js | ≥ 22 (tested on 24) | JavaScript runtime for admin & mobile apps |
| pnpm | ≥ 11 | Package manager for the JS monorepo |
| .NET SDK | 10 | ASP.NET Core API backend |
| Git | Any recent | Source control |

For mobile development only:
- Xcode (iOS simulator, macOS only) and/or Android Studio, or the **Expo Go** app on a physical device

---

### 1. Install Node.js

**Windows (recommended — nvm-windows):**

Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) (pick the latest `.exe` installer), then open a **new** terminal:

```powershell
nvm install 24
nvm use 24
node --version   # should print v24.x.x
```

**macOS (recommended — nvm):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# restart your terminal, then:
nvm install 24
nvm use 24
node --version   # should print v24.x.x
```

### 2. Install pnpm

pnpm is a fast, disk-efficient package manager (like npm or yarn, but better for monorepos). It ships with Node.js via **corepack** — you just need to enable it:

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version   # should print 11.x.x
```

> **What is corepack?** It's a tool bundled with Node.js (since v16.9) that manages package manager versions — there is nothing extra to install. Running `corepack enable` activates it, and `corepack prepare` downloads the correct pnpm version. No separate installer or PATH changes needed.

**If `pnpm` is not recognized after running `corepack prepare`**, try these in order:

1. **Close and reopen your terminal.** Corepack creates shims (`.cmd` files) in the Node.js directory that your current terminal session may not detect until restarted.
2. **Run `corepack enable` as Administrator (Windows).** The command needs write access to the Node.js install directory to create the pnpm shim. Right-click your terminal → "Run as Administrator", then re-run `corepack enable && corepack prepare pnpm@latest --activate`.
3. **Check for execution policy errors (Windows PowerShell).** If you see `UnauthorizedAccess` instead of "not recognized", PowerShell is blocking the `pnpm.ps1` shim. See the PowerShell note below.

**If none of the above work**, install pnpm globally via npm instead:

```bash
npm install -g pnpm
pnpm --version   # should print 11.x.x
```

**Windows PowerShell note:** If you get an `UnauthorizedAccess` error when running `pnpm`, PowerShell is blocking the script. Fix it with:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

This only needs to be done once per machine and does not require admin rights.

### 3. Install .NET SDK

**Windows:**

Download and install the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) (pick the Windows x64 installer).

```powershell
dotnet --version   # should print 10.x.x
```

**macOS:**

```bash
# via Homebrew
brew install dotnet@10

# or download from https://dotnet.microsoft.com/download/dotnet/10.0
dotnet --version   # should print 10.x.x
```

### 4. Authenticate with GitHub

To push/pull from the repo, authenticate the GitHub CLI:

```bash
gh auth login
```

Follow the prompts — select **GitHub.com**, **HTTPS**, and authenticate via **browser**. This automatically configures Git credentials.

---

## Install

```bash
pnpm install                      # all JS workspace packages
dotnet build apps/sona.server/sona.server.csproj   # restore + build the API
```

> **Don't remove these config files** — the repo's `.npmrc` sets `node-linker=hoisted` (required by Expo) and `pnpm-workspace.yaml` pins `lightningcss` (required by NativeWind).
>
> **Windows note:** If `pnpm install` fails with an `EBUSY` symlink error, simply re-run `pnpm install`. This is a known Windows issue where antivirus or file indexing briefly locks newly-created directories. Retrying usually succeeds on the second or third attempt.

## Database (SQL Server)

The API uses SQL Server via EF Core. Which database it talks to depends on the environment:

| `ASPNETCORE_ENVIRONMENT` | Connection string source | Auth |
|---|---|---|
| `Development` / `Production` | Azure Key Vault secret `DefaultConnection` (vault in `Keyvault:_keyvaultURI`) | Entra ID (OIDC) |
| `Local` | `ConnectionStrings:DefaultConnection` in `appsettings.Local.json` | stub — see [Running locally without Azure](#running-locally-without-azure-local-profile) |

A second, **optional** connection string `OpieConnection` points at the external, read-only
`Opie_data` practice-management database that feeds the dashboard's Opie Schedule table
(`docs/opie-odbc-integration.md`). Same sourcing as `DefaultConnection`: Key Vault secret
`OpieConnection` in `Development`/`Production` (a missing secret is tolerated), the
`ConnectionStrings:OpieConnection` key in `appsettings.Local.json` in `Local`. When it is absent
the API still starts and `GET /api/opie/schedule` answers `503 { error: "opie-not-configured" }`.
Use a read-only SQL login; never commit real values.

`Development` therefore requires HCA Azure credentials (`az login` against the HCA tenant). Without them the API cannot start — use the `Local` profile instead.

For local development, run SQL Server in Docker:

```bash
docker run -d --name sona-sql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='SonaDev_Local1!' -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

> **Apple Silicon:** the SQL Server image is amd64-only — enable **Rosetta emulation** in Docker Desktop (Settings → General → "Use Rosetta for x86_64/amd64 emulation").
>
> **Windows without Docker:** SQL Server Express or LocalDB works too — use `Server=(localdb)\\MSSQLLocalDB;Database=SonaLocal;Trusted_Connection=True;TrustServerCertificate=True;` as the `Local` connection string.

Apply migrations (creates the database on first run):

```bash
dotnet tool restore
dotnet dotnet-ef database update --project apps/sona.server
```

Against the local container, set the environment first so EF picks up `appsettings.Local.json`:

```bash
# macOS/Linux
ASPNETCORE_ENVIRONMENT=Local dotnet dotnet-ef database update --project apps/sona.server
# PowerShell
$env:ASPNETCORE_ENVIRONMENT='Local'; dotnet dotnet-ef database update --project apps/sona.server
```

Re-run `database update` whenever you pull new migrations. To add a migration after changing entities:

```bash
dotnet dotnet-ef migrations add <Name> --project apps/sona.server --output-dir Data/Migrations
```

Migrations live in `apps/sona.server/Data/Migrations/` (not the EF default `Migrations/` — pass `--output-dir` as above). There is **no** `DesignTimeDbContextFactory` (deliberately deleted 2026-08-31 — a factory's placeholder connection string hijacked `database update` against the real database). EF tooling therefore runs `Program.cs`, which means it needs either Azure credentials or `ASPNETCORE_ENVIRONMENT=Local`.

### One-time: Azure dev db reconciliation after the 2026-08-27 baseline rebuild

The migration history was rebuilt on 2026-08-27: the original `InitialCreate` had an empty `Up()` (tables were created out-of-band on the Azure dev db), so all prior migrations (`20260811191806_InitialCreate`, `20260811192219_serilog`, `20260820194331_UniqueMrnIndex`, `20260824175305_AddProviderTable`) were replaced by a single `20260827173132_InitialCreate` capturing the full model. A **fresh** database now builds correctly from `database update` alone.

The existing Azure dev db already has all tables and rows in `__EFMigrationsHistory` naming the old migration ids. **A human with db access must reconcile it once** — either:

- **Option A (keep data):** rewrite the history table so EF considers the new baseline applied:

  ```sql
  DELETE FROM __EFMigrationsHistory;
  INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
  VALUES ('20260827173132_InitialCreate', '10.0.11');
  ```

  Do **not** run `database update` before this — EF would try to re-create existing tables and fail.

- **Option B (disposable data):** drop and recreate the dev database, then run `dotnet dotnet-ef database update --project apps/sona.server`.

Until one of these is done, `database update` against the Azure dev db will fail with "object already exists" errors. Local/fresh databases are unaffected.

## Environment

Each frontend reads its API base URL from an env file (both default to `http://localhost:5032`):

```bash
cp apps/sona.client/.env.example apps/sona.client/.env
cp apps/mobile/.env.example apps/mobile/.env
```

For mobile on a **physical device**, replace `localhost` with your machine's LAN IP.

### SMS via Webex Connect (optional for local dev)

The API sends "ready to be seen" texts through **Webex Connect**. Without configuration the API still starts and runs normally — SMS dispatch is simply disabled, and every notify attempt is audited as `failed` with `FailureReason = "sms-not-configured"`.

To enable real sends, fill the `WebexConnect` section (placeholders live in `apps/sona.server/appsettings.json` — `TODO(config)`: the real values are being pulled from another app by the team). Put them in `apps/sona.server/appsettings.Development.json` (git-ignored values only) or environment variables — never commit real values:

```jsonc
"WebexConnect": {
  "keyvaultUri": "https://<vault>.vault.azure.net/", // vault holding the service key
  "baseApiUrl": "https://<region>.webexconnect.io",  // tenant region base URL
  "defaultFromSMS": "<sender number/id>"             // required — Webex rejects a missing "from"
}
```

Environment-variable form: `WebexConnect__keyvaultUri`, `WebexConnect__baseApiUrl`, `WebexConnect__defaultFromSMS`.

The Webex **service key is never placed in a settings file** — it lives in Azure Key Vault as secret `WebexConnectServiceKey` and is fetched lazily on the first send (so developers without Azure/Key Vault access can still run the API; their sends fail cleanly as `sms-not-configured`).

## Run

```bash
# API (terminal 1) → http://localhost:5032
dotnet run --project apps/sona.server

# Web admin (terminal 2) → https://localhost:5173
pnpm dev:admin

# Mobile (terminal 3) — press i for iOS simulator, a for Android
pnpm dev:mobile
```

## Running locally without Azure (`Local` profile)

The default `Development` environment pulls its connection string from Azure Key Vault and
authenticates through Entra ID, so it only starts on a machine signed in to the HCA tenant.
The **`Local`** environment is a personal-machine profile that replaces both with local
stand-ins, so the admin UI can actually be exercised against a running API.

> **Nothing about `Development`/`Production` changes.** Every `Local` branch is gated on
> `ASPNETCORE_ENVIRONMENT=Local`; any other environment name runs the unchanged Azure path.

### Setup

1. Start a local SQL Server (Docker or LocalDB — see [Database](#database-sql-server) above).
2. Create your settings file from the committed template:

   ```bash
   cp apps/sona.server/appsettings.Local.example.json apps/sona.server/appsettings.Local.json
   ```

   `appsettings.Local.json` is git-ignored. Set `ConnectionStrings:DefaultConnection` to your
   local server, and optionally change the stub identity under `LocalDevAuth`
   (`Hca34Id`, `Name`, `Email`).

3. Create the schema:

   ```bash
   ASPNETCORE_ENVIRONMENT=Local dotnet dotnet-ef database update --project apps/sona.server
   ```

4. Run the API and the admin:

   ```bash
   dotnet run --project apps/sona.server --launch-profile "sona.server (Local)"
   pnpm dev:admin
   ```

   The `sona.server (Local)` launch profile sets `ASPNETCORE_ENVIRONMENT=Local` and binds both
   `http://localhost:5032` (redirects to https) and `https://localhost:7296` (the Vite dev-server
   proxy target for `/api` and `/auth`). Keep the admin's `VITE_API_URL` **empty** so it calls
   `/api` on its own origin through that proxy — a browser rejects the http→https redirect on the
   CORS preflight if you point it at 5032 directly.

### ⚠️ Never point `Local` at Azure

`Local` authenticates every request as a stub system admin, so aiming it at the shared dev
database would bypass every real access control. Startup **refuses** any connection string
containing `database.windows.net` or `Authentication=Active Directory`:

```
Local mode refuses to start: ConnectionStrings:DefaultConnection points at Azure SQL …
```

### What is stubbed in `Local`

| Area | `Development` | `Local` |
|---|---|---|
| Connection string | Key Vault secret `DefaultConnection` | `appsettings.Local.json` |
| Opie_data connection (optional) | Key Vault secret `OpieConnection` | `ConnectionStrings:OpieConnection` in `appsettings.Local.json` (omit → dashboard shows "Opie connection not configured") |
| Serilog | MSSqlServer `AppLogs` sink + console | console only |
| Authentication | Entra ID OIDC | `LocalDevAuth` scheme — every request is the configured identity, no sign-in screen |
| JIT user provisioning | OIDC `OnTokenValidated` | middleware on the first authenticated request; the created user is promoted to `system_admin` (once — a role you later change through the UI sticks) |
| `/auth/login` | Entra challenge | redirect straight back to `AzureAd:RedirectUri` |
| MSGraph (directory search, invite name lookup) | live | **not configured** — returns no results / `503` |
| SMS (Webex Connect) | live if configured | **not configured** — sends are audited as `failed` with `sms-not-configured` |

**Roles are not stubbed.** `LocalDevAuth` emits no role claim; the role still comes from
`AppUsers.Role`, so org/role authorization is exercised for real. On a fresh database the stub
user is promoted to `system_admin` on its first request; to test other roles, change the row
(or use the user-management UI) — it will not be promoted again.


## Verify

```bash
pnpm typecheck    # TS across all workspace packages (incl. test + e2e files)
pnpm build        # production builds
pnpm test         # Vitest: packages/shared schemas + apps/sona.client components/routes (MSW-mocked API)
pnpm lint         # oxlint (client + packages) and expo lint (mobile, eslint-config-expo flat config)
```

`pnpm lint` needs no first-run step: the one postinstall it depends on (`unrs-resolver`, pulled in by
`eslint-config-expo`) is already allowed in `pnpm-workspace.yaml` → `allowBuilds`. It must never modify
`package.json`, the lockfile or `pnpm-workspace.yaml` — if it does, a dependency went missing.

End-to-end (real browser against the real API in the `Local` profile — needs a local SQL Server and
`appsettings.Local.json`, see below; Chromium once via `pnpm --filter sona.client exec playwright install chromium`):

```bash
pnpm e2e                                          # full suite; starts the API + admin if not already running
pnpm --filter sona.client e2e --grep @smoke       # the PR-blocking subset
pnpm --filter sona.client e2e:ui                  # Playwright UI mode
pnpm --filter sona.client e2e:codegen             # record a click path against https://localhost:5173
```

Specs switch the dev user's role through `PUT /api/local/me/role` (Local-only) and create their own
data through the API with `E2E-` prefixed identifiers; patients are soft-deleted afterwards, invited
test users and E2E organizations/sites remain (no delete endpoints).

## Gotchas

- **Route tree generation (sona.client):** `src/routeTree.gen.ts` is generated by the TanStack Router Vite plugin when `vite dev`/`vite build` runs. On a fresh clone, run `pnpm dev:admin` or `pnpm build` once before `typecheck`.
- **`expo-env.d.ts` (mobile):** auto-generated by Expo; committed so typecheck works without starting the dev server first.
- **Adding mobile native deps:** use `npx expo install <pkg>` (not `pnpm add`) inside `apps/mobile` so versions match the SDK.
