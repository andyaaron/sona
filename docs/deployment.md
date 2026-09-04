# Deployment — admin + API to Azure (dev site)

The admin (`apps/sona.client`) is a static Vite bundle **served by the API** from `wwwroot`;
there is one deployable: the published `apps/sona.server` output. Both go to a single Azure
App Service. The mobile app is not covered here.

## How the deployable is built

`azure-pipelines.yml` (Azure DevOps, `main` branch, `windows-latest` agent) produces artifact `drop/`:

| File | Built by | Purpose |
|---|---|---|
| `deploy.zip` | `pnpm build` → `dotnet publish -c Release` | App Service zip deploy (API dll + `wwwroot/` admin bundle) |

Order matters: `pnpm build` writes `apps/sona.server/wwwroot` (git-ignored, see
`vite.config.ts` `build.outDir`) and `dotnet publish` picks that folder up as content. Publishing
without the Vite build ships an API with no UI. `dotnet publish` deliberately excludes
`appsettings.Local*.json` (`sona.server.csproj`) — that file carries local credentials.

Reproduce locally (this is what the pipeline does):

```bash
pnpm install --frozen-lockfile
pnpm build
dotnet publish apps/sona.server/sona.server.csproj -c Release -o /tmp/sona-publish
```

Smoke-test the published output against the local Docker SQL Server (docs/getting-started.md
§ Local profile) — `/`, `/patients`, `/assets/*.js`, `/favicon.svg` must all be `200`, `/api/organizations` must return JSON:

```bash
cp apps/sona.server/appsettings.Local.json /tmp/sona-publish/ && cd /tmp/sona-publish && ASPNETCORE_ENVIRONMENT=Local ASPNETCORE_URLS=http://localhost:5099 dotnet sona.server.dll
```

## App Service configuration (Development environment)

Runtime: .NET 10 (framework-dependent publish). App settings (`Configuration → Application settings`):

| Setting | Value | Why |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` | Loads `appsettings.Development.json` (Azure dev SQL, Opie org id). Anything other than `Local` takes the Key Vault + Entra path. Do **not** use `Local` in Azure — it is stub auth and refuses Azure SQL on purpose. |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` | Linux App Service only. TLS terminates at the front end; without this the OIDC callback and `UseHttpsRedirection` see `http://` and the Entra redirect URI won't match. Windows (in-process IIS) does this on its own. |
| `Keyvault___keyvaultURI` | `https://sona-dev-vault.vault.azure.net/` | Already in `appsettings.json`; override only for another environment. (`Keyvault:_keyvaultURI` — the key has a leading underscore, hence three underscores.) |
| `AzureAd__RedirectUri` | *(unset)* | Post-login landing page defaults to `/`. Only Development-on-a-laptop needs the Vite origin (`appsettings.Development.json` sets `https://localhost:5173/` — override to `/` in Azure if you keep `ASPNETCORE_ENVIRONMENT=Development`). |
| `Opie__OrganizationId` | GUID | Already in `appsettings.Development.json`; must be an `Organizations.Id` that exists in *that* database. |

Because `ASPNETCORE_ENVIRONMENT=Development` also carries the laptop-only `AzureAd:RedirectUri`, set
`AzureAd__RedirectUri=/` on the App Service (app settings win over JSON), or create an
`appsettings.Dev.json` + `ASPNETCORE_ENVIRONMENT=Dev` if the dev site should diverge further from
the laptop profile. Note `MapOpenApi()` is also Development-only.

### Identity / secrets

- **Managed identity** on the App Service with `Key Vault Secrets User` on `sona-dev-vault`
  (vault firewall must admit the App Service). Startup reads secret `DefaultConnection` (required — the
  API will not start without it) and `OpieConnection` (optional; absent → Opie dashboard reports "not
  configured"). SMS reads `WebexConnectServiceKey` lazily on first send.
- **Azure SQL**: `DefaultConnection` in Key Vault uses `Authentication="Active Directory Default"`, so the
  same managed identity needs a contained user in `sona-dev-sqldb`
  (`CREATE USER [<app-service-name>] FROM EXTERNAL PROVIDER; ALTER ROLE db_datareader/db_datawriter ADD MEMBER ...`).
  Serilog also writes to `AppLogs` in that db (`db_datawriter` covers writes; the table is not part of the EF migrations — if `sona-dev-sqldb` does not have it yet, create it once by hand or grant `db_ddladmin`).
- **Entra app registration** `1d138810-…` (`appsettings.json` `AzureAd`): add the site's callback
  `https://<app-service-host>/signin-oidc` to the Web redirect URIs, and set the front-channel logout URL if sign-out is wired up later. Without the redirect URI Entra answers `AADSTS50011`.

### Database

Schema is not applied by the pipeline (the build agent has no path to Key Vault or the db).
`sona-dev-sqldb` is already at the latest migration — it is the db the Development profile
uses day to day. After adding a migration, apply it from a workstation with Entra access before
deploying the build that needs it:

```bash
dotnet dotnet-ef database update --project apps/sona.server
```

(uses `appsettings.Development.json`'s connection string with your own Entra identity).

## Checklist for the first deploy

1. Pipeline green → `drop/deploy.zip`.
2. App Service: .NET 10 runtime, app settings above, managed identity on, Key Vault + SQL access granted.
3. Entra redirect URI added.
4. `sona-dev-sqldb` at the latest migration (`dotnet dotnet-ef database update`, see above).
5. Zip deploy `deploy.zip` (`az webapp deploy --type zip` or the release-stage `AzureWebApp@1` task).
6. Browse `https://<host>/` → Entra sign-in → admin loads; `https://<host>/api/organizations` returns JSON once signed in.
   First sign-in creates the `AppUsers` row via OIDC `OnTokenValidated`; someone with db access then sets `Role = system_admin` for that row.

## Known gaps (not blocking a dev site)

- No release stage in `azure-pipelines.yml` yet — deploy is manual (step 5) until the App Service exists and its name/service connection are known.
- Assembly/version stamping was dropped from the pipeline (the previous file was a copy of another project's and referenced `Sona.Api.csproj`, which does not exist here).
- `appsettings.Development.json` serves double duty (laptop + Azure dev). Split into a `Dev`/`Staging` environment once the dev site settles.
