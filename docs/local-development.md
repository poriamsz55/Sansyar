# Local development

## Requirements

- Go 1.25+
- Node.js 18+
- Docker

## Run Mongo and API

```bash
docker compose -f deploy/docker-compose.yml up -d mongo
cd backend
cp .env.example .env
go run ./cmd/api
```

Seed login accounts all use `Password123!`:

- Super admin: `09000000000`
- Venue owner: `09120000000`
- Customer: `09350000000`

## Run web apps

```bash
npm install
npm run dev:web
npm run dev:admin
```

Customer PWA: `http://localhost:5173`

Admin panel: `http://localhost:5174`

API: `http://localhost:8080`
