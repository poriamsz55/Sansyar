# Architecture

## Monorepo layout

```text
apps/web       Customer PWA and responsive desktop web app
apps/admin     Venue owner and super admin management panel
backend        Go Echo API using MongoDB
deploy         Docker Compose and deployment helpers
docs           Product, backend, data, booking, payment, and local docs
scripts        Local helper scripts
```

## Backend

The backend follows `docs/go-api-service-blueprint.md`:

- `cmd/api/bootstrap`: composition root, route setup, server lifecycle, indexes, seed data.
- `internal/<domain>`: domain entities, services, and handlers.
- `pkg`: config, Mongo repository, JWT, middleware, request context, validation, logging, SMS abstraction, and error mapping.

Request flow is middleware -> handler -> service -> generic repository or external provider.

## Frontend choice

Vite React was chosen over Next.js because the current repo is greenfield, the MVP is dashboard/PWA heavy, SEO is not the main launch constraint, and Vite keeps two apps fast and simple in a workspace. The architecture still allows a future Next.js migration if public SEO pages become critical.

## Assumptions

- Currency values are stored in Iranian rial minor units and displayed as toman in the UI.
- Public registration supports `customer` and `venue_owner`; staff/manager accounts are admin-created later.
- Local map uses open map libraries; production tile/provider policy is a deployment decision.
- Payments and SMS ship as clean abstractions first, with fake/dev providers until real provider contracts are selected.
