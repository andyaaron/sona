# Task 13 — Run the API locally without Azure (Key Vault + Entra) — personal-machine mode

**Prerequisites:** Read `docs/tasks/_context.md` and `AGENTS.md`. Server-only change. Coordinate with Task 12 (tests) — this task is what makes browser verification possible on machines without HCA Azure access.

## Problem

`apps/sona.server/Program.cs` cannot start without HCA Azure credentials:

1. **Key Vault at startup** — `new SecretClient(keyVaultUri, new DefaultAzureCredential()).GetSecret("DefaultConnection")` runs synchronously before the host is built. No creds ⇒ `CredentialUnavailableException`, process exits (observed 2026-09-01 on the personal Mac).
2. **Serilog MSSqlServer sink** uses that same connection string.
3. **Entra OIDC** is the only authentication scheme; every `/api/*` route is `[Authorize]`. Even with a database, nobody can sign in outside the HCA tenant.

Consequence: on the personal repo/machine nothing beyond `dotnet build` can be verified; every UI feature since Task 03 shipped without being rendered against a live API. The Webex util already handles its own Key Vault lazily (Task 07) — the DB/auth path does not.

## Constraint — must not affect the work repo

The work repo runs `Development`/`Production` against Azure and must keep doing so with **zero behaviour change**. Therefore everything below is gated on a **new environment name `Local`** (`ASPNETCORE_ENVIRONMENT=Local`) and on a git-ignored `appsettings.Local.json`. If the env is not `Local`, the code path is byte-for-byte the current one. No flags in `appsettings.json`/`appsettings.Development.json`, no new defaults.

## Requirements

### 1. `Local` environment profile

- `Properties/launchSettings.json`: add a `sona.server (Local)` profile — `ASPNETCORE_ENVIRONMENT=Local`, same URLs (`http://localhost:5032`).
- `.gitignore`: add `apps/sona.server/appsettings.Local.json`. Commit `appsettings.Local.example.json` with placeholders (below) — never real values.
- `Program.cs`: introduce `var isLocal = builder.Environment.IsEnvironment("Local");` and branch **only** on it.

### 2. Database without Key Vault

- `isLocal` ⇒ connection string comes from `ConnectionStrings:DefaultConnection` in `appsettings.Local.json`; **skip the `SecretClient` entirely**. Otherwise: existing Key Vault pull, unchanged.
- **Safety guard:** in `Local`, refuse to start (throw with a clear message) if the connection string contains `database.windows.net` or `Authentication=Active Directory` — Local mode is for a disposable local SQL Server only, never the Azure dev db.
- Serilog: in `Local`, console sink only (the MSSqlServer sink needs the `AppLogs` table and a real connection; keep it for non-Local exactly as is).
- Target db: the Docker SQL Server already documented in `docs/getting-started.md` (`sona-sql` container). Verify that section still matches reality (it references `ConnectionStrings__Sona` and a `SonaDev` database — reconcile with the actual key `DefaultConnection`) and add the Local steps: start container → `dotnet ef database update` with `ASPNETCORE_ENVIRONMENT=Local` → run.
- `dotnet ef` in Local: with the env var set, EF's host-builder path picks up `appsettings.Local.json`, so **no `DesignTimeDbContextFactory` is needed** (it stays deleted — see `_context.md` for why).

### 3. Authentication without Entra — `LocalDevAuth`

- New `Models/Auth/LocalDevAuthHandler.cs`: an `AuthenticationHandler<LocalDevAuthOptions>` that always succeeds with a principal built from `appsettings.Local.json`:
  ```jsonc
  "LocalDevAuth": {
    "Hca34Id": "DEV001",           // becomes preferred_username = DEV001@hca.corpad.net
    "Name": "Dev Admin",
    "Email": "dev.admin@example.com"
  }
  ```
  Emit exactly the claims the app reads today: `preferred_username` (`ConstantDefaults.ENTRAID_CLAIMS_USER_PRINCIPAL_NAME`), `name`, the givenname/surname/emailaddress URIs in `ConstantDefaults`. **Do not** add a parallel "role" claim — roles still come from `AppUsers.Role` via `CurrentUserService`, so tenant/role enforcement is exercised for real.
- Registration: `isLocal` ⇒ `AddAuthentication("LocalDev").AddScheme<LocalDevAuthOptions, LocalDevAuthHandler>("LocalDev", …)` and **do not** call `AddMicrosoftIdentityWebApp`; also skip the `PostConfigure<OpenIdConnectOptions>` block (it is OIDC-only) — instead, on first request in Local, run `IAppUserUtil.CheckAndSetEmployee(principal)` once (e.g. a tiny middleware) so the JIT user row is created the same way Entra login would. Non-Local keeps the current `AddMicrosoftIdentityWebApp` path untouched.
- `AuthController.Login` (`/auth/login`): in Local, `Challenge` on a scheme that always succeeds is meaningless — return `Redirect(RedirectUri)` so the admin's 401→`/auth/login` bounce still lands back on the app. Non-Local unchanged.
- **Hard guard:** the handler class throws in its constructor if `!env.IsEnvironment("Local")`. Belt and braces against a mis-registration ever reaching a real environment.
- `MSGraphHelper` is a singleton that talks to Graph with its own Key Vault/secret setup — verify how it initializes; in Local it must construct lazily/no-op so the API starts (directory search and invite-name lookup return empty/503 in Local — acceptable, document it).

### 4. Local seed

- A `Local`-only startup step (or a documented SQL script in `docs/getting-started.md`) that, on an empty db: ensures the `ready-to-be-seen` template row exists and promotes the `LocalDevAuth` user to `system_admin` after JIT creation. Keep it idempotent. Nothing in it may run outside `Local`.

### 5. Docs

- `docs/getting-started.md`: new section "Running locally without Azure (Local profile)" — Docker SQL, `appsettings.Local.json` from the example, `ASPNETCORE_ENVIRONMENT=Local`, what is stubbed (auth, Graph, Webex → `sms-not-configured`), and the explicit warning that Local is never pointed at Azure.
- `_context.md`: note the profile exists and that agents **should use it to actually exercise the UI before declaring frontend tasks done**.

## Verification (executed, not reviewed)

1. `ASPNETCORE_ENVIRONMENT=Local dotnet run --project apps/sona.server` starts on a machine with no Azure credentials; `GET /api/user` returns the `LocalDevAuth` user with role from the db.
2. Admin at `https://localhost:5173` loads, sign-in bounce works, patients/providers/user-management render against the local db.
3. `ASPNETCORE_ENVIRONMENT=Development dotnet run` behaves exactly as before (still requires Azure; failure mode unchanged) — diff `Program.cs` non-Local path against `main` to prove it is untouched.
4. Local guard: point `DefaultConnection` at `*.database.windows.net` ⇒ startup refuses with the guard message.

## Out of scope

Real multi-user local login, seeding fake patients (use the UI), any change to production auth, removing the startup Key Vault pull for non-Local environments.

## Definition of Done

Per `_context.md`, plus the four verification steps above executed and reported; `dotnet build Sona.slnx` passes; docs updated; tick in `docs/patient-tasks.md`; delete this prompt on completion.
