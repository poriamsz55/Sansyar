# Sansyar

Production-grade MVP foundation for a Persian RTL sports venue discovery, booking, payment, wallet, and venue-owner management platform.

## Structure

```text
apps/web       Customer PWA
apps/admin     Owner/admin dashboard
backend        Echo + MongoDB API
deploy         Docker Compose
docs           Architecture and product documentation
scripts        Local helpers
```

## Quick start

```bash
docker compose -f deploy/docker-compose.yml up -d mongo
cd backend && cp .env.example .env && go run ./cmd/api
npm install
npm run dev:web
npm run dev:admin
```

See `docs/local-development.md` for seeded accounts and details.
