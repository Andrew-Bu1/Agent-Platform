# Agent Studio — Architecture Overview

**Last updated:** 2026-05-21  
**Status:** Backend complete (all phases implemented)

---

## What is Agent Studio?

Agent Studio is the **Java Spring Boot backend** that acts as the primary API gateway and BFF (Backend For Frontend) for the entire platform. It owns:

- Agent & Tool definitions (CRUD)
- Flow canvas versioning and publishing
- Thin proxies to all downstream microservices (IAM, AIHub, DataHub, Orchestrator)

It does **not** run agents or execute flows — that is the Orchestrator's job.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Java 17, Spring Boot 3.4.1 |
| Auth | Stateless JWT (RS256 via `libs/java/common`); `token_type` must be `access`; optional issuer/audience validation via `JWT_ISSUER` / `JWT_AUDIENCE` env vars |
| DB | PostgreSQL (Flyway migrations, Spring Data JPA) |
| HTTP Client | Spring `RestClient` + `JdkClientHttpRequestFactory` (HTTP/1.1, for proxying) |
| SSE | Spring `SseEmitter` + `@Async` thread pool |
| Build | Maven 3 (reactor parent `pom.xml`) |

---

## Database Schema (agent_studio DB)

All Flyway migrations live in `services/agent-studio/src/main/resources/db/migration/`.

| Migration | Description |
|---|---|
| `V1__init.sql` | Core schema — agents, tools, flows, flow_versions, threads, runs, node_runs, messages, run_events, human_review_tasks |
| `V2__agent_tool_ids.sql` | Adds `tool_ids UUID[]` column to agents |
| `V3__agent_model_id.sql` | Adds `model_id VARCHAR(255)` column to agents |
| `V4__tool_type_expand.sql` | Expands `tool_type` CHECK constraint with additional types |

> **Note on `messages` table:** `messages` has `node_run_id UUID NULL` and `metadata_json JSONB` columns. The agent-worker `MessageRepository` selects and inserts both of these fields. Do not omit them when extending message queries.
> 
> The `role` column accepts: `user`, `assistant`, `system`, `tool`, and `summary`. The `summary` role is written by the agent-worker when the `summarize` memory strategy triggers — it stores a compressed digest of prior conversation turns. No schema migration is needed as the column is `VARCHAR(50)` with no check constraint.

### Key Tables

```
agents          — reusable agent/team library items
tools           — reusable tool definitions (http, function, webhook, …)
                  has input_schema JSONB + output_schema JSONB
flows           — mutable flow canvas metadata
flow_versions   — immutable published snapshot (graph_json + settings_json)
threads         — conversation/session boundary (links runs together)
runs            — one execution of one flow_version
node_runs       — per-node execution record within a run
messages        — conversation messages; role: user|assistant|system|tool|summary (node_run_id + metadata_json nullable)
run_events      — persisted SSE events for reconnect/replay
human_review_tasks — first-class human review/approval task
```

---

## Security

### JWT Validation

`JwtAuthFilter` validates every non-public request:

1. **Signature** — RS256 public key fetched from IAM at startup (`GET /.well-known/jwks.json`).
2. **Expiry** — standard `exp` claim check.
3. **`token_type`** — must equal `"access"`. Pre-auth and refresh tokens are rejected with 401.
4. **Issuer** — checked when `JWT_ISSUER` env var is non-blank (set in production; leave blank for local dev).
5. **Audience** — checked when `JWT_AUDIENCE` env var is non-blank.

See `services/agent-studio/.env.example` for the relevant variables.

### Feature Entitlements

Agent Studio uses `FeatureGuardService` to enforce tenant-level feature flags on write operations. It calls `GET {IAM_URL}/entitlements/features` with the caller's bearer token, parses the `{ data: [{ featureKey, enabled }] }` response, and caches results per `tenantId` for **5 minutes**. If IAM is unreachable the guard **fails open** (allows the request) to preserve availability.

| Feature key | Gates |
|---|---|
| `agent_studio.agents` | create, update, delete agents |
| `agent_studio.tools` | create, update, delete tools |
| `agent_studio.flows` | create, update, delete flows and all version write/publish operations |

---

## API Surface (agent-studio)

Base path: `/api/v1`  
Auth header: `Authorization: Bearer <access_token>`  
All responses: `ApiResponse<T>` envelope from `libs/java/common`.

### Agents

| Method | Path | Description | Permission required | Feature required |
|---|---|---|---|---|
| `GET` | `/agents` | List agents (paginated) | `agent:read` | — |
| `POST` | `/agents` | Create agent | `agent:create` | `agent_studio.agents` |
| `GET` | `/agents/{id}` | Get agent | `agent:read` | — |
| `PUT` | `/agents/{id}` | Update agent | `agent:update` | `agent_studio.agents` |
| `DELETE` | `/agents/{id}` | Archive agent | `agent:delete` | `agent_studio.agents` |

**Agent fields (added):**
- `tool_ids: UUID[]` — list of Tool IDs attached to this agent
- `model_id: String` — AIHub model identifier (e.g. `gpt-4o`)

### Tools

| Method | Path | Description | Permission required | Feature required |
|---|---|---|---|---|
| `GET` | `/tools` | List tools (paginated) | `tool:read` | — |
| `POST` | `/tools` | Create tool | `tool:create` | `agent_studio.tools` |
| `GET` | `/tools/{id}` | Get tool | `tool:read` | — |
| `PUT` | `/tools/{id}` | Update tool | `tool:update` | `agent_studio.tools` |
| `DELETE` | `/tools/{id}` | Archive tool | `tool:delete` | `agent_studio.tools` |

### Flows

| Method | Path | Description | Permission required | Feature required |
|---|---|---|---|---|
| `GET` | `/flows` | List flows (paginated) | `flow:read` | — |
| `POST` | `/flows` | Create flow | `flow:create` | `agent_studio.flows` |
| `GET` | `/flows/{id}` | Get flow | `flow:read` | — |
| `PUT` | `/flows/{id}` | Update flow | `flow:update` | `agent_studio.flows` |
| `DELETE` | `/flows/{id}` | Archive flow | `flow:delete` | `agent_studio.flows` |
| `GET` | `/flows/{id}/versions` | List versions | `flow:read` | — |
| `POST` | `/flows/{id}/versions` | Create draft version | `flow:update` | `agent_studio.flows` |
| `GET` | `/flows/{id}/versions/{vid}` | Get version | `flow:read` | — |
| `PUT` | `/flows/{id}/versions/{vid}` | Update draft version | `flow:update` | `agent_studio.flows` |
| `POST` | `/flows/{id}/versions/{vid}/publish` | Publish version | `flow:publish` | `agent_studio.flows` |

**Publish validation** (enforced in `FlowService.publish()`):
- `graph_json` must be valid JSON
- `entry_node_id` must be non-null and non-blank
- `nodes` must be a non-empty object (keyed by node ID — not an array)

See [graph_json.md](../../agent_layer/graph_json.md) for the complete node schema and agentic pattern reference.

---

## BFF Proxy Layer

Agent Studio proxies all calls from the frontend to downstream services, forwarding the original bearer token. This means the frontend only talks to one service.

> **HTTP/1.1 constraint:** All five `RestClient` beans (`aihubClient`, `datahubClient`, `iamClient`, `iamPublicClient`, `orchestratorClient`) are configured with `JdkClientHttpRequestFactory(HttpClient.HTTP_1_1)`. Spring Boot 3.4's default `HttpClient` negotiates HTTP/2, which sends an `Upgrade: h2c` header on plain HTTP connections. Neither uvicorn (AIHub) nor the Go `net/http` servers (DataHub, Orchestrator) support h2c cleartext upgrade, causing spurious log warnings. Pinning to HTTP/1.1 prevents the upgrade attempt; SSE streaming is unaffected because it relies on chunked transfer encoding, a standard HTTP/1.1 feature.

```
Browser / Agent Studio Web
         │
         ▼
   agent-studio :8080
   /api/v1/auth/**      ─── IAM Service :8080
   /api/v1/tenants/**   ─── IAM Service :8080
   /api/v1/aihub/**     ─── AIHub :8000
   /api/v1/datahub/**   ─── DataHub :8082
   /api/v1/orchestrator/threads/**  ─── Orchestrator :8085
   /api/v1/orchestrator/runs/**     ─── Orchestrator :8085
```

### IAM Proxy (`/api/v1/auth/**`, `/api/v1/tenants/**`)

**Auth endpoints** (public — no JWT required):

| Method | BFF Path | IAM Path |
|---|---|---|
| `POST` | `/api/v1/auth/signup` | `POST /auth/signup` |
| `POST` | `/api/v1/auth/login` | `POST /auth/login` |
| `POST` | `/api/v1/auth/refresh` | `POST /auth/refresh` |
| `POST` | `/api/v1/auth/workspaces` | `POST /auth/workspaces` |
| `POST` | `/api/v1/auth/switch-context` | `POST /auth/switch-context` |
| `POST` | `/api/v1/auth/logout/session` | `POST /auth/logout/session` |
| `POST` | `/api/v1/tenants/bootstrap` | `POST /tenants/bootstrap` |

**Auth endpoints** (JWT required):

| Method | BFF Path | IAM Path |
|---|---|---|
| `GET` | `/api/v1/auth/me` | `GET /auth/me` |
| `POST` | `/api/v1/auth/logout` | `POST /auth/logout` |
| `PATCH` | `/api/v1/auth/me/password` | `PATCH /auth/me/password` |

**Tenant management** (JWT required):

| Method | BFF Path | IAM Path |
|---|---|---|
| `GET` | `/api/v1/tenants` | `GET /tenants` |
| `POST` | `/api/v1/tenants` | `POST /tenants` |
| `GET` | `/api/v1/tenants/{id}` | `GET /tenants/{id}` |
| `GET` | `/api/v1/tenants/{id}/members` | `GET /tenants/{id}/members` |
| `POST` | `/api/v1/tenants/{id}/members` | `POST /tenants/{id}/members` |
| `DELETE` | `/api/v1/tenants/{id}/members/{uid}` | `DELETE /tenants/{id}/members/{uid}` |
| `POST` | `/api/v1/tenants/{id}/members/{uid}/roles` | `POST /tenants/{id}/members/{uid}/roles` |
| `DELETE` | `/api/v1/tenants/{id}/members/{uid}/roles/{roleKey}` | `DELETE /tenants/{id}/members/{uid}/roles/{roleKey}` |
| `GET` | `/api/v1/tenants/{id}/workspaces` | `GET /tenants/{id}/workspaces` |
| `POST` | `/api/v1/tenants/{id}/workspaces` | `POST /tenants/{id}/workspaces` |
| `GET` | `/api/v1/tenants/{id}/workspaces/{wid}` | `GET /tenants/{id}/workspaces/{wid}` |
| `GET` | `/api/v1/tenants/{id}/workspaces/{wid}/members` | `GET /tenants/{id}/workspaces/{wid}/members` |
| `POST` | `/api/v1/tenants/{id}/workspaces/{wid}/members` | `POST /tenants/{id}/workspaces/{wid}/members` |
| `DELETE` | `/api/v1/tenants/{id}/workspaces/{wid}/members/{uid}` | `DELETE /tenants/{id}/workspaces/{wid}/members/{uid}` |
| `POST` | `/api/v1/tenants/{id}/workspaces/{wid}/members/{uid}/roles` | `POST /tenants/{id}/workspaces/{wid}/members/{uid}/roles` |
| `DELETE` | `/api/v1/tenants/{id}/workspaces/{wid}/members/{uid}/roles/{roleKey}` | `DELETE /tenants/{id}/workspaces/{wid}/members/{uid}/roles/{roleKey}` |

Tenant and workspace member invite payloads are `{ email, roleKey }`. Member mutation endpoints require `tenant_admin`. Member list responses include `joinedAt`.

**Role and permission management** (JWT required):

| Method | BFF Path | IAM Path |
|---|---|---|
| `GET` | `/api/v1/roles` | `GET /roles` |
| `POST` | `/api/v1/roles` | `POST /roles` |
| `GET` | `/api/v1/roles/{roleId}` | `GET /roles/{roleId}` |
| `PATCH` | `/api/v1/roles/{roleId}` | `PATCH /roles/{roleId}` |
| `DELETE` | `/api/v1/roles/{roleId}` | `DELETE /roles/{roleId}` |
| `GET` | `/api/v1/roles/{roleId}/permissions` | `GET /roles/{roleId}/permissions` |
| `POST` | `/api/v1/roles/{roleId}/permissions` | `POST /roles/{roleId}/permissions` |
| `DELETE` | `/api/v1/roles/{roleId}/permissions/{permissionId}` | `DELETE /roles/{roleId}/permissions/{permissionId}` |
| `GET` | `/api/v1/permissions` | `GET /permissions` |
| `GET` | `/api/v1/permissions/me` | `GET /permissions/me` |
| `POST` | `/api/v1/permissions` | `POST /permissions` |
| `DELETE` | `/api/v1/permissions/{id}` | `DELETE /permissions/{id}` |

### AIHub Proxy (`/api/v1/aihub/**`)

| Method | BFF Path | AIHub Path |
|---|---|---|
| `GET` | `/api/v1/aihub/models` | `GET /v1/models` |
| `POST` | `/api/v1/aihub/models` | `POST /v1/models` |
| `GET` | `/api/v1/aihub/models/{id}` | `GET /v1/models/{id}` |
| `PATCH` | `/api/v1/aihub/models/{id}` | `PATCH /v1/models/{id}` |
| `DELETE` | `/api/v1/aihub/models/{id}` | `DELETE /v1/models/{id}` |
| `GET` | `/api/v1/aihub/providers` | `GET /v1/providers` |
| `POST` | `/api/v1/aihub/providers` | `POST /v1/providers` |
| `GET` | `/api/v1/aihub/providers/{id}` | `GET /v1/providers/{id}` |
| `PATCH` | `/api/v1/aihub/providers/{id}` | `PATCH /v1/providers/{id}` |
| `DELETE` | `/api/v1/aihub/providers/{id}` | `DELETE /v1/providers/{id}` |
| `GET` | `/api/v1/aihub/model-usage-logs` | `GET /v1/model-usage-logs` |
| `POST` | `/api/v1/aihub/chat` | `POST /v1/chat` |
| `POST` | `/api/v1/aihub/chat/stream` | `POST /v1/chat` (SSE stream) |
| `GET` | `/api/v1/aihub/platform/analytics/usage` | `GET /v1/platform/analytics/usage` |

### DataHub Proxy (`/api/v1/datahub/**`)

Agent Studio wraps DataHub's raw downstream JSON in the standard `ApiResponse<T>` envelope before returning it to the web client.

| Method | BFF Path | DataHub Path |
|---|---|---|
| `GET` | `/api/v1/datahub/datasources` | `GET /datasources` |
| `POST` | `/api/v1/datahub/datasources` | `POST /datasources` |
| `GET` | `/api/v1/datahub/datasources/{id}` | `GET /datasources/{id}` |
| `PUT` | `/api/v1/datahub/datasources/{id}` | `PUT /datasources/{id}` |
| `DELETE` | `/api/v1/datahub/datasources/{id}` | `DELETE /datasources/{id}` |
| `POST` | `/api/v1/datahub/datasources/{id}/search` | `POST /datasources/{id}/search` |
| `GET` | `/api/v1/datahub/datasources/{dsId}/documents` | `GET /datasources/{dsId}/documents` |
| `POST` | `/api/v1/datahub/datasources/{dsId}/documents` | `POST /datasources/{dsId}/documents` |
| `GET` | `/api/v1/datahub/documents/{id}` | `GET /documents/{id}` |
| `PUT` | `/api/v1/datahub/documents/{id}` | `PUT /documents/{id}` |
| `DELETE` | `/api/v1/datahub/documents/{id}` | `DELETE /documents/{id}` |
| `GET` | `/api/v1/datahub/documents/{docId}/ingestions` | `GET /documents/{docId}/ingestions` |
| `POST` | `/api/v1/datahub/documents/{docId}/ingestions` | `POST /documents/{docId}/ingestions` |
| `GET` | `/api/v1/datahub/ingestions/{id}` | `GET /ingestions/{id}` |
| `DELETE` | `/api/v1/datahub/ingestions/{id}` | `DELETE /ingestions/{id}` |
| `GET` | `/api/v1/datahub/ingestions/{ingId}/chunks` | `GET /ingestions/{ingId}/chunks` |
| `GET` | `/api/v1/datahub/chunks/{id}` | `GET /chunks/{id}` |
| `GET` | `/api/v1/datahub/ingestions/dlq` | `GET /ingestions/dlq` |
| `POST` | `/api/v1/datahub/ingestions/dlq/replay` | `POST /ingestions/dlq/replay` |
| `DELETE` | `/api/v1/datahub/ingestions/dlq` | `DELETE /ingestions/dlq` |

### Orchestrator Proxy (`/api/v1/orchestrator/**`)

**Threads:**

| Method | BFF Path | Orchestrator Path |
|---|---|---|
| `POST` | `/api/v1/orchestrator/threads` | `POST /threads` |
| `GET` | `/api/v1/orchestrator/threads` | `GET /threads` |
| `GET` | `/api/v1/orchestrator/threads/{id}` | `GET /threads/{id}` |
| `GET` | `/api/v1/orchestrator/threads/{id}/runs` | `GET /threads/{id}/runs` |

**Runs:**

| Method | BFF Path | Orchestrator Path | Notes |
|---|---|---|---|
| `POST` | `/api/v1/orchestrator/runs` | `POST /runs` | Returns initial run JSON |
| `GET` | `/api/v1/orchestrator/runs/{id}` | `GET /runs/{id}` | Run snapshot |
| `POST` | `/api/v1/orchestrator/runs/{id}/cancel` | `POST /runs/{id}/cancel` | |
| `POST` | `/api/v1/orchestrator/runs/{id}/resume` | `POST /runs/{id}/resume` | Human review decision |
| `GET` | `/api/v1/orchestrator/runs/{id}/events` | `GET /runs/{id}/events` | SSE stream (proxied) |
| `GET` | `/api/v1/orchestrator/runs/pending-review` | `GET /runs/pending-review` | All waiting_for_human runs |

> **SSE proxy note:** `GET /runs/{id}/events` uses `SseEmitter(-1L)` + `@Async("sseProxyExecutor")` 
> (core=20, max=200 threads). The Tomcat thread is released immediately; the async thread 
> reads from the orchestrator and pipes events to the emitter.

---

## Configuration (`application.properties`)

```properties
app.iam.url=${IAM_URL:http://localhost:8080}
app.aihub.url=${AIHUB_URL:http://localhost:8000}
app.datahub.url=${DATAHUB_URL:http://localhost:8082}
app.orchestrator.url=${ORCHESTRATOR_URL:http://localhost:8085}
spring.mvc.async.request-timeout=-1
```

---

## Security

- `JwtAuthFilter` (from `libs/java/common`) verifies RS256 tokens on every request
- `AuthContext` principal is injected into controller/service methods
- Bearer token is forwarded to all downstream services via `bearerForwardInterceptor()`
- Permit-all paths (no JWT): `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/signup`, `/api/v1/auth/workspaces`, `/api/v1/auth/switch-context`, `/api/v1/auth/logout/session`, `/api/v1/tenants/bootstrap`

---

## Error Handling

All errors map through `GlobalExceptionHandler` (auto-configured from `libs/java/common`):

| Exception | HTTP Status |
|---|---|
| `NotFoundException` | 404 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `ConflictException` | 409 |
| `AppException(VALIDATION_ERROR)` | 400 |
| `AppException(INTERNAL_SERVER_ERROR)` | 500 |
| Proxy `HttpClientErrorException` | Mapped to `AppException` then handled above |

Response envelope:
```json
{
  "success": false,
  "errorCode": "NOT_FOUND",
  "message": "Flow not found: <uuid>"
}
```

---

## Source Layout

```
services/agent-studio/src/main/java/com/agentplatform/studio/
├── config/
│   ├── DownstreamConfig.java      — RestClient beans (iam, aihub, datahub, orchestrator)
│   ├── SecurityConfig.java        — JWT filter + permit-all paths
│   └── SseConfig.java             — @EnableAsync + sseProxyExecutor thread pool
├── entity/
│   ├── Agent.java                 — JPA entity (tool_ids UUID[], model_id)
│   ├── Flow.java
│   ├── FlowVersion.java
│   └── Tool.java
├── repository/                    — Spring Data JPA repositories
├── service/
│   ├── AgentService.java
│   ├── FlowService.java           — includes publish graph_json validation
│   ├── ToolService.java
│   ├── IamProxyService.java       — IAM proxy (public + bearer clients)
│   ├── AihubProxyService.java     — AIHub proxy
│   ├── DatahubProxyService.java   — DataHub proxy
│   └── OrchestratorProxyService.java — Orchestrator proxy (+ async SSE streaming)
└── api/
    ├── agent/                     — AgentController, AgentDto, CreateAgentRequest, UpdateAgentRequest
    ├── flow/                      — FlowController, FlowVersionController, DTOs
    ├── tool/                      — ToolController, DTOs
    └── bff/
        ├── iam/
        │   ├── IamAuthController.java
        │   └── IamTenantController.java
        ├── aihub/
        │   └── AihubProxyController.java
        ├── datahub/
        │   └── DatahubProxyController.java
        └── orchestrator/
            ├── OrchestratorThreadController.java
            └── OrchestratorRunController.java
```
