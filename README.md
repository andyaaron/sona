# Sona

Nurse/provider-to-patient communication platform. Providers use the web admin to ping patients that they're ready to be seen; patients receive a push notification (if they have the mobile app) or an SMS.

## Repository layout

```
├── apps/
│   ├── admin/        # Web admin (React + Vite + TanStack Router)
│   ├── mobile/       # Patient mobile app (Expo / React Native)
│   └── api/          # Backend (ASP.NET Core, .NET 10)
├── packages/
│   ├── shared/       # Shared TypeScript types + zod schemas
│   └── api-client/   # Typed API client used by admin + mobile
└── docs/             # Architecture, tech stack, and compliance docs
```

## Quickstart

Prerequisites: Node ≥ 22, pnpm ≥ 11 (`corepack enable`), .NET SDK 10.

```bash
pnpm install                          # JS workspace deps
pnpm dev:admin                        # web admin → http://localhost:5173
pnpm dev:mobile                       # Expo dev server (press i for iOS simulator)
dotnet run --project apps/api/Sona.Api  # API → http://localhost:5032
```

## Documentation

- [Architecture](docs/architecture.md) — monorepo structure, bulletproof-react pattern, notification flow
- [Tech stack](docs/tech-stack.md) — what we use and why
- [Getting started](docs/getting-started.md) — full local setup
- [Compliance](docs/compliance.md) — HIPAA considerations (read before touching notifications)
