.PHONY: all build test run-datahub run-data-worker run-aihub run-agent-studio

# ── Go services ──────────────────────────────────────────────────────────────

build-go:
	go -C services/datahub         build ./cmd/...
	go -C services/data-worker     build ./cmd/...
	go -C services/agent-orchestrator build ./cmd/...
	go -C services/agent-worker    build ./cmd/...

test-go:
	go -C services/datahub         test ./...
	go -C services/data-worker     test ./...
	go -C services/agent-orchestrator test ./...
	go -C services/agent-worker    test ./...

run-datahub:
	go -C services/datahub run ./cmd/...

run-data-worker:
	go -C services/data-worker run ./cmd/...

run-agent-orchestrator:
	go -C services/agent-orchestrator run ./cmd/...

run-agent-worker:
	go -C services/agent-worker run ./cmd/...

# ── Python services ───────────────────────────────────────────────────────────

run-aihub:
	uv run --directory services/aihub uvicorn src.main:app


# ── Infrastructure ────────────────────────────────────────────────────────────

up:
	docker compose -f infrastructure/docker/compose.yml up -d

down:
	docker compose -f infrastructure/docker/compose.yml down

# ── All ───────────────────────────────────────────────────────────────────────

build: build-go build-agent-studio
