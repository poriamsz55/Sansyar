.PHONY: api test web admin compose-up compose-down

api:
	cd backend && go run ./cmd/api

test:
	cd backend && go test ./...
	npm test

web:
	npm run dev:web

admin:
	npm run dev:admin

compose-up:
	docker compose -f deploy/docker-compose.yml up -d

compose-down:
	docker compose -f deploy/docker-compose.yml down
