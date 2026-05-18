.DEFAULT_GOAL := help

COMPOSE = docker compose -f infrastructure/docker/compose.yml
MVN     = mvn

# ─────────────────────────────────────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

# ─────────────────────────────────────────────────────────────────────────────
# Environment files
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: env
env: ## Copy .env.example → .env for services that have no .env yet
	@for dir in services/*/; do \
	  if [ -f "$${dir}.env.example" ] && [ ! -f "$${dir}.env" ]; then \
	    cp "$${dir}.env.example" "$${dir}.env"; \
	    echo "Created $${dir}.env"; \
	  fi; \
	done

# ─────────────────────────────────────────────────────────────────────────────
# Infrastructure (Docker Compose — Postgres, Redis, MinIO)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: up down restart logs ps rebuild-iam health-iam
up: ## Start infrastructure containers
	$(COMPOSE) up -d

down: ## Stop infrastructure containers
	$(COMPOSE) down

restart: down up ## Restart infrastructure containers

logs: ## Follow infrastructure logs  (Ctrl-C to exit)
	$(COMPOSE) logs -f

ps: ## Show running containers
	$(COMPOSE) ps

rebuild-iam: ## Rebuild and recreate IAM service so actuator changes are in the running container
	$(COMPOSE) up -d --build --force-recreate iam-service

health-iam: ## Print IAM container health endpoint response
	$(COMPOSE) exec iam-service wget -qO- http://localhost:8080/actuator/health

# ─────────────────────────────────────────────────────────────────────────────
# Database migrations  (run 'make up' first)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: migrate
migrate: ## Apply Postgres migrations for aihub and datahub (iam-service and agent-studio use Flyway on startup)
	@echo "→ Creating databases..."
	@PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres \
	  -f migrations/postgres/init.sql
	@echo "→ aihub migrations..."
	@for f in $$(ls migrations/postgres/aihub/*.sql | sort); do \
	  echo "  $$f"; \
	  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d aihub -f "$$f"; \
	done
	@echo "→ datahub migrations..."
	@for f in $$(ls migrations/postgres/datahub/*.sql | sort); do \
	  echo "  $$f"; \
	  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d datahub -f "$$f"; \
	done
	@echo "✓ Migrations applied. iam-service and agent-studio schemas are managed by Flyway (applied on service start)."

# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: build build-go build-java build-web
build: build-go build-java build-web ## Build all services

build-go: ## Compile all Go services (from repo root, uses go.work)
	go build -o /dev/null ./services/datahub/cmd/
	go build -o /dev/null ./services/data-worker/cmd/
	go build -o /dev/null ./services/agent-orchestrator/cmd/
	go build -o /dev/null ./services/agent-worker/cmd/

build-java: ## Build Java services (common + iam-service + agent-studio)
	$(MVN) -pl libs/java/common,services/iam-service,services/agent-studio \
	       -am package -DskipTests -q

build-web: ## Build frontend (Vite → dist/)
	cd services/agent-studio-web && npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: test test-go test-java
test: test-go test-java ## Run all tests

test-go: ## Run Go tests
	go test ./services/datahub/...
	go test ./services/data-worker/...
	go test ./services/agent-orchestrator/...
	go test ./services/agent-worker/...

test-java: ## Run Java tests
	$(MVN) -pl libs/java/common,services/iam-service,services/agent-studio \
	       -am test -q

# ─────────────────────────────────────────────────────────────────────────────
# Lint
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: lint lint-go lint-web
lint: lint-go lint-web ## Lint all services

lint-go: ## Vet all Go services
	go vet ./services/datahub/...
	go vet ./services/data-worker/...
	go vet ./services/agent-orchestrator/...
	go vet ./services/agent-worker/...

lint-web: ## Lint frontend (ESLint)
	cd services/agent-studio-web && npm run lint

# ─────────────────────────────────────────────────────────────────────────────
# Run  (local dev — each service reads its own .env)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: run-iam run-agent-studio run-datahub run-data-worker run-aihub \
        run-agent-orchestrator run-agent-worker run-web

run-iam: ## Run IAM service (Spring Boot, port 8080)
	$(MVN) -pl libs/java/common install -DskipTests -q
	$(MVN) spring-boot:run -pl services/iam-service

run-agent-studio: ## Run Agent Studio BFF (Spring Boot, port 8082)
	$(MVN) -pl libs/java/common install -DskipTests -q
	$(MVN) spring-boot:run -pl services/agent-studio

run-datahub: ## Run DataHub API (Go, port 8084)
	go run ./services/datahub/cmd/

run-data-worker: ## Run Data Worker (Go, queue consumer)
	go run ./services/data-worker/cmd/

run-aihub: ## Run AIHub service (Python / uvicorn, port 8000)
	uv run --directory services/aihub uvicorn src.main:app --reload

run-agent-orchestrator: ## Run Agent Orchestrator (Go, port 8081)
	go run ./services/agent-orchestrator/cmd/

run-agent-worker: ## Run Agent Worker (Go, queue consumer)
	go run ./services/agent-worker/cmd/

run-web: ## Run frontend dev server (Vite, port 5173, hot-reload)
	cd services/agent-studio-web && npm run dev

# ─────────────────────────────────────────────────────────────────────────────
# Docker images  (all built from repo root as context)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: docker-build \
        docker-build-iam docker-build-agent-studio docker-build-agent-studio-web \
        docker-build-datahub docker-build-data-worker docker-build-aihub \
        docker-build-agent-orchestrator docker-build-agent-worker

docker-build: ## Build all Docker images
docker-build: docker-build-iam docker-build-agent-studio docker-build-agent-studio-web \
              docker-build-datahub docker-build-data-worker docker-build-aihub \
              docker-build-agent-orchestrator docker-build-agent-worker

docker-build-iam: ## Build iam-service image
	docker build -f services/iam-service/Dockerfile \
	             -t agent-platform/iam-service:latest .

docker-build-agent-studio: ## Build agent-studio image
	docker build -f services/agent-studio/Dockerfile \
	             -t agent-platform/agent-studio:latest .

docker-build-agent-studio-web: ## Build agent-studio-web (nginx) image
	docker build -f services/agent-studio-web/Dockerfile \
	             -t agent-platform/agent-studio-web:latest \
	             services/agent-studio-web/

docker-build-datahub: ## Build datahub image
	docker build -f services/datahub/Dockerfile \
	             -t agent-platform/datahub:latest .

docker-build-data-worker: ## Build data-worker image
	docker build -f services/data-worker/Dockerfile \
	             -t agent-platform/data-worker:latest .

docker-build-aihub: ## Build aihub image
	docker build -f services/aihub/Dockerfile \
	             -t agent-platform/aihub:latest .

docker-build-agent-orchestrator: ## Build agent-orchestrator image
	docker build -f services/agent-orchestrator/Dockerfile \
	             -t agent-platform/agent-orchestrator:latest .

docker-build-agent-worker: ## Build agent-worker image
	docker build -f services/agent-worker/Dockerfile \
	             -t agent-platform/agent-worker:latest .
