# Agent Platform

A multi-tenant AI agent platform for creating, deploying, and managing AI agents with visual flow editing, a RAG knowledge base, multi-agent orchestration, and analytics.

---

## Architecture Overview

The platform is a monorepo composed of 8 services:

| Service | Stack | Port | Role |
|---|---|---|---|
| `iam-service` | Java 21 / Spring Boot 3.4 | 8081 | Auth, tenants, workspaces, roles, JWT issuance, OAuth, JWKS |
| `agent-studio` | Java 21 / Spring Boot 3.4 | 8082 | BFF — CRUD for agents, tools, flows; proxies all downstream APIs |
| `aihub` | Python 3.12 / FastAPI | 8083 | LLM gateway — chat, embedding, rerank; provider management; entitlement enforcement |
| `datahub` | Go 1.25 | 8084 | RAG data layer — datasources, documents, chunks, ingestion; pgvector |
| `data-worker` | Go 1.25 | — | Background ingestion worker (parse → chunk → embed → pgvector) |
| `agent-orchestrator` | Go 1.25 | 8085 | Flow execution engine — runs graphs, streams SSE events |
| `agent-worker` | Go 1.25 | — | Node execution worker — ReAct loops, tool calls, human review pauses |
| `agent-studio-web` | React 18 / TypeScript / Vite | 5173 | Studio UI — flow editor, runs, traces, analytics, access control |

All frontend requests are proxied through `agent-studio` (BFF) at `/api/v1/*`.

---

## Prerequisites

- Docker + Docker Compose
- Go 1.25+
- Java 21 + Maven 3.9+
- Python 3.12 + [uv](https://github.com/astral-sh/uv)
- Node.js 20+ + npm

---

## Quick Start

### 1. Start infrastructure

```bash
make up
```

Starts PostgreSQL (port 5433), Redis (port 6379), and MinIO (ports 9000/9001) via Docker Compose.

### 2. Set up environment files

```bash
make env
```

Copies `.env.example` → `.env` for each service that doesn't have one yet.

### 3. Apply database migrations

```bash
make migrate
```

Creates the `agent_studio`, `aihub`, `datahub`, and `iam` databases and applies all SQL migrations.
`iam-service` and `agent-studio` manage their own schemas via Flyway on startup.

### 4. Run services

In separate terminals (or use your process manager of choice):

```bash
make run-iam                # IAM Service          — :8081
make run-agent-studio       # Agent Studio BFF     — :8082
make run-aihub              # AIHub LLM Gateway    — :8083
make run-datahub            # DataHub API          — :8084
make run-data-worker        # Data Worker
make run-agent-orchestrator # Agent Orchestrator   — :8085
make run-agent-worker       # Agent Worker
make run-web                # Frontend dev server  — :5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Repository Layout

```
.
├── services/
│   ├── iam-service/           # Java — auth & identity
│   ├── agent-studio/          # Java — BFF
│   ├── agent-studio-web/      # React — frontend
│   ├── aihub/                 # Python — LLM gateway
│   ├── datahub/               # Go — RAG data layer
│   ├── data-worker/           # Go — ingestion worker
│   ├── agent-orchestrator/    # Go — flow execution engine
│   └── agent-worker/          # Go — node execution worker
├── libs/
│   ├── go/common/             # Go shared: auth middleware, MinIO client
│   ├── java/common/           # Java shared: JWT, ApiResponse, error codes
│   └── python/common/         # Python shared: DB/Redis clients, logger
├── migrations/postgres/       # Standalone SQL migrations (aihub, datahub)
├── infrastructure/docker/     # Docker Compose (Postgres, Redis, MinIO)
├── docs/                      # Architecture docs
└── Makefile                   # All dev commands
```

---

## Authentication

- `iam-service` issues **RS256 JWTs** signed with a rotating RSA key.
- All other services verify tokens via the JWKS endpoint (`GET /oauth/jwks`).
- Token claims include: `sub`, `tenant_id`, `workspace_id`, `permissions[]`, `type` (`user` | `service_client`).
- Permission keys: `agent:run`, `flow:run`, `model:invoke`, `model:manage` (platform_admin), `member:manage` (tenant_admin / workspace_owner).

---

## Flow Editor & Orchestration

Flows are visual directed graphs stored as JSON. Supported node types:

| Node | Description |
|---|---|
| `start` / `end` | Entry and terminal nodes |
| `agent` | ReAct loop via AIHub |
| `agent_team` | Supervisor-handoff multi-agent |
| `if_else` | Conditional branch (`{{.field}} == value`) |
| `router` | Routes by `output.route` string |
| `parallel` | Fires all outgoing edges simultaneously |
| `aggregator` | Waits for all parallel branches |
| `human_review` | Pauses run; resumes via API |

Runs stream events over SSE (`text/event-stream`). Missed events can be replayed via `GET /runs/{id}/events`.

---

## Build & Test

```bash
make build        # Build all services
make test         # Run all tests
make lint         # Lint all services
```

Individual targets: `build-go`, `build-java`, `build-web`, `test-go`, `test-java`, `lint-go`, `lint-web`.

---

## Docker Images

```bash
make docker-build              # Build all images
make docker-build-<service>    # Build a single image
```

Images are tagged `agent-platform/<service>:latest`.

---

## Infrastructure Commands

```bash
make up           # Start containers
make down         # Stop containers
make restart      # Restart containers
make logs         # Follow logs
make ps           # Show running containers
```

---

## License

See [LICENSE](LICENSE).
