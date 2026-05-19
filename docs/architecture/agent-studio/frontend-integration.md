# Frontend Integration Guide

**Last updated:** 2026-05-19

This guide explains how the **Agent Studio Web** frontend (React/Vite, `services/agent-studio-web/`) should talk to the backend. The backend is fully implemented and ready for the frontend to connect.

---

## Single Base URL

The frontend only ever talks to **one service**: `agent-studio` (default `:8080`).  
It never calls IAM, AIHub, DataHub, or the Orchestrator directly.

```
VITE_API_BASE_URL=http://localhost:8080
```

All API paths are under `/api/v1/`.

---

## Authentication Flow

```
1. POST /api/v1/auth/login          { email, password }
   → { access_token, refresh_token, workspace_id, tenant_id }

2. Store access_token in memory (NOT localStorage for security)
   Store refresh_token in httpOnly cookie (preferred) or memory

3. Every API call: Authorization: Bearer <access_token>

4. On 401: POST /api/v1/auth/refresh  { refresh_token }
   → { access_token, refresh_token }

5. POST /api/v1/auth/logout          (invalidates server-side)
```

**Multi-workspace:**
```
POST /api/v1/auth/workspaces        { email, password }
→ [{ workspace_id, workspace_name, tenant_id }]

POST /api/v1/auth/switch-context    { workspace_id }
→ { access_token }    (new token scoped to that workspace)
```

---

## Standard Response Envelope

All JSON responses (success and error) use:

```json
{
  "success": true,
  "data": { ... }
}
```

```json
{
  "success": false,
  "errorCode": "NOT_FOUND",
  "message": "Flow not found: <uuid>"
}
```

Paginated responses:
```json
{
  "success": true,
  "data": {
    "content": [ ... ],
    "totalElements": 42,
    "totalPages": 3,
    "size": 20,
    "number": 0
  }
}
```

---

## Field Naming Conventions

All API responses follow a consistent naming strategy based on service boundary:

| Layer | Convention | Example |
|---|---|---|
| Go backend HTTP responses (`RunResponse`, `ThreadResponse`, etc.) | **camelCase** | `flowVersionId`, `tenantId`, `createdAt` |
| Go backend DB models (internal only) | snake_case | `flow_version_id`, `tenant_id` |
| DataHub / data-worker responses (Go) | snake_case | `chunk_strategy`, `document_id` |
| Frontend TypeScript interfaces | match what the backend sends | `Run` → camelCase; `NodeRun` → snake_case |

The BFF (agent-studio Java) proxies responses as-is without field transformation. Orchestrator responses (threads, runs, node-runs) are already camelCase in Go JSON tags and the frontend types match. DataHub responses remain snake_case and the frontend `Datasource`, `Document`, `Ingestion`, `NodeRun` types match.

> The BFF unwraps the orchestrator's `{success, data}` envelope before re-wrapping into its own `ApiResponse<T>`. Do **not** double-unwrap in the frontend — read `response.data` once.

---

## API Sections

### Agents (`/api/v1/agents`)

```
GET    /api/v1/agents              → paginated list
POST   /api/v1/agents              create
GET    /api/v1/agents/{id}         get
PUT    /api/v1/agents/{id}         update
DELETE /api/v1/agents/{id}         archive
```

**Agent fields:**
```json
{
  "id": "uuid",
  "name": "My Agent",
  "description": "...",
  "agentKind": "react | team",
  "definitionJson": {},
  "toolIds": ["uuid", "uuid"],
  "modelId": "gpt-4o",
  "status": "draft | active | archived",
  "createdAt": "RFC3339",
  "updatedAt": "RFC3339"
}
```

### Tools (`/api/v1/tools`)

```
GET    /api/v1/tools
POST   /api/v1/tools
GET    /api/v1/tools/{id}
PUT    /api/v1/tools/{id}
DELETE /api/v1/tools/{id}
```

### Flows & Flow Versions (`/api/v1/flows`)

```
GET    /api/v1/flows
POST   /api/v1/flows
GET    /api/v1/flows/{id}
PUT    /api/v1/flows/{id}
DELETE /api/v1/flows/{id}

GET    /api/v1/flows/{id}/versions
POST   /api/v1/flows/{id}/versions
GET    /api/v1/flows/{id}/versions/{vid}
PUT    /api/v1/flows/{id}/versions/{vid}
POST   /api/v1/flows/{id}/versions/{vid}/publish
```

**Publish requirements** (validated server-side):
- `graph_json` must contain `entry_node_id` (non-empty string)
- `graph_json` must contain at least one entry in `nodes`

### Threads (`/api/v1/orchestrator/threads`)

```
POST   /api/v1/orchestrator/threads         { title?, metadata? }
GET    /api/v1/orchestrator/threads         ?limit=20&offset=0
GET    /api/v1/orchestrator/threads/{id}
GET    /api/v1/orchestrator/threads/{id}/runs
```

### Runs (`/api/v1/orchestrator/runs`)

```
POST   /api/v1/orchestrator/runs            { flow_version_id, thread_id?, input }
GET    /api/v1/orchestrator/runs/{id}
POST   /api/v1/orchestrator/runs/{id}/cancel
POST   /api/v1/orchestrator/runs/{id}/resume  { task_id, output }
GET    /api/v1/orchestrator/runs/{id}/events  → SSE stream
GET    /api/v1/orchestrator/runs/pending-review
```

### AIHub (`/api/v1/aihub`)

```
GET    /api/v1/aihub/models
POST   /api/v1/aihub/models
GET    /api/v1/aihub/models/{id}
PUT    /api/v1/aihub/models/{id}
DELETE /api/v1/aihub/models/{id}

GET    /api/v1/aihub/providers
POST   /api/v1/aihub/providers
GET    /api/v1/aihub/providers/{id}
PUT    /api/v1/aihub/providers/{id}
DELETE /api/v1/aihub/providers/{id}

GET    /api/v1/aihub/model-usage-logs
```

### DataHub (`/api/v1/datahub`)

All DataHub BFF responses use the standard `ApiResponse<T>` envelope even though the downstream DataHub service returns raw JSON. The frontend should read payloads from `data`.

```
GET|POST              /api/v1/datahub/datasources
GET|PUT|DELETE        /api/v1/datahub/datasources/{id}
POST                  /api/v1/datahub/datasources/{id}/search  { query, top_k? }
GET|POST              /api/v1/datahub/datasources/{dsId}/documents
GET|PUT|DELETE        /api/v1/datahub/documents/{id}
GET|POST              /api/v1/datahub/documents/{docId}/ingestions
GET|DELETE            /api/v1/datahub/ingestions/{id}
GET                   /api/v1/datahub/ingestions/{ingId}/chunks
GET                   /api/v1/datahub/chunks/{id}
```

#### DataHub DLQ Admin

Dead-letter queue endpoints for failed ingestion jobs. Intended for platform administrators.

```
GET    /api/v1/datahub/ingestions/dlq?limit=100   list DLQ entries (default limit 100)
POST   /api/v1/datahub/ingestions/dlq/replay       re-enqueue all entries to the ingestion queue
DELETE /api/v1/datahub/ingestions/dlq              permanently clear the DLQ
```

**`GET /api/v1/datahub/ingestions/dlq` response:**
```json
{
  "total": 3,
  "entries": [
    {
      "queue": "datahub:queue:ingestion",
      "payload": "{...}",
      "error": "embedding model not found",
      "queued_at": "2026-05-15T12:34:56Z"
    }
  ]
}
```

**`POST /api/v1/datahub/ingestions/dlq/replay` response:**
```json
{ "replayed": 3 }
```

**`DELETE /api/v1/datahub/ingestions/dlq`** — returns `204 No Content`.

> The DLQ Redis key is configured via `REDIS_DLQ_KEY` on the DataHub service (default: `datahub:queue:dlq`). Replay moves each entry from the DLQ back to the source queue key stored in `entry.queue`.

### IAM — Tenant Management (`/api/v1/tenants`)

```
GET|POST              /api/v1/tenants
GET                   /api/v1/tenants/{id}
GET|POST              /api/v1/tenants/{id}/members
DELETE                /api/v1/tenants/{id}/members/{uid}
POST                  /api/v1/tenants/{id}/members/{uid}/roles            { roleKey }
DELETE                /api/v1/tenants/{id}/members/{uid}/roles/{roleKey}
GET|POST              /api/v1/tenants/{id}/workspaces
GET                   /api/v1/tenants/{id}/workspaces/{wid}
GET|POST              /api/v1/tenants/{id}/workspaces/{wid}/members
DELETE                /api/v1/tenants/{id}/workspaces/{wid}/members/{uid}
POST                  /api/v1/tenants/{id}/workspaces/{wid}/members/{uid}/roles          { roleKey }
DELETE                /api/v1/tenants/{id}/workspaces/{wid}/members/{uid}/roles/{roleKey}
```

Member invite payloads:

```json
// POST /api/v1/tenants/{id}/members
{ "email": "user@example.com", "roleKey": "tenant_admin" }

// POST /api/v1/tenants/{id}/workspaces/{wid}/members
{ "email": "user@example.com", "roleKey": "workspace_member" }
```

Member responses include `joinedAt`:

```json
{
  "userId": "...",
  "email": "user@example.com",
  "name": "User Name",
  "joinedAt": "2026-05-11T00:00:00Z",
  "roles": ["workspace_member"]
}
```

### IAM — Roles & Permissions (`/api/v1/roles`, `/api/v1/permissions`)

```
GET|POST              /api/v1/roles
GET|PATCH|DELETE      /api/v1/roles/{roleId}
GET|POST              /api/v1/roles/{roleId}/permissions
DELETE                /api/v1/roles/{roleId}/permissions/{permissionId}

GET|POST              /api/v1/permissions
DELETE                /api/v1/permissions/{permissionId}
GET                   /api/v1/permissions/me
```

Role/member mutation endpoints require `tenant_admin`. Role assignment validates scope: tenant member role assignments require `scopeType = "tenant"`; workspace member role assignments require `scopeType = "workspace"`.

---

## Flow Canvas — graph_json Contract

The canvas editor (`FlowEditorPage`) saves the flow graph as `graph_json` when the user clicks **Save** or **Publish**. The orchestrator reads this JSON at run-start and must parse it without modification.

### Node Types (FE → Backend)

The FE `NodeKind` type and the backend `GraphNode.Type` string must always stay in sync:

| Canvas `NodeKind` | Backend handling | `data` fields sent |
|---|---|---|
| `start` | Orchestrator inline | `{}` |
| `end` | Orchestrator inline | `{}` |
| `agent` | Agent Worker | `{ agentId, modelId?, maxIterations?, memory? }` — `memory` overrides the agent-level default; see memory config below |
| `agent_team` | Agent Worker | `{ agentId, entryAgentId, exitAgentId?, memberAgentIds?, maxIterations?, memory? }` — supervisor-handoff only; `memory` applies to supervisor only |
| `if_else` | Orchestrator inline | `{ ifExpression }` |
| `human_review` | Agent Worker | `{}` |
| `router` | Orchestrator inline | `{ routes: [{label, handle}] }` |
| `parallel` | Orchestrator inline | `{ branchCount }` |
| `aggregator` | Agent Worker | `{ agentId, strategy? }` |

#### Memory config shape (`memory?`)

```json
{
  "memory_strategy": "last_n | summarize | none",
  "memory_last_n": 20,
  "memory_summarize_threshold": 40,
  "memory_summarize_model": "gpt-4o-mini"
}
```

Resolution priority: **node `data.memory`** → **agent entity `definition.memory`** → default `{strategy:"last_n", last_n:20}`.

| Strategy | Behaviour |
|---|---|
| `last_n` | Load the most recent `memory_last_n` messages before each run (default window: 20). |
| `summarize` | Keep a rolling `role=summary` message in the thread. Summarize when unsummarized tail exceeds `memory_summarize_threshold` (default: 40). Summarizer model defaults to the agent's own model. |
| `none` | Skip all thread history — agent is stateless per run. |

Full field reference: [graph_json.md § Memory Configuration](../../agent_layer/graph_json.md)

> **`agentId` is camelCase.** The orchestrator model and Go worker both use json tag `"agentId"` to match this. Never use `agent_id` in `data` objects.

### graph_json Wire Format

```json
{
  "entry_node_id": "start-1",
  "nodes": {
    "start-1":   { "type": "start",   "label": "Start",  "data": {},                        "position": {"x":100,"y":200} },
    "agent-1":   { "type": "agent",   "label": "Writer", "data": { "agentId": "uuid-..." }, "position": {"x":350,"y":200} },
    "if_else-1": { "type": "if_else", "label": "Gate",   "data": { "ifExpression": "{{.quality}} == good" }, "position": {"x":600,"y":200} },
    "end-1":     { "type": "end",     "label": "End",    "data": {},                        "position": {"x":850,"y":200} }
  },
  "edges": [
    { "id": "e0", "source": "start-1",   "target": "agent-1" },
    { "id": "e1", "source": "agent-1",   "target": "if_else-1" },
    { "id": "e2", "source": "if_else-1", "target": "end-1",   "label": "true"  },
    { "id": "e3", "source": "if_else-1", "target": "agent-1", "label": "false" }
  ]
}
```

`nodes` is a **JSON object** (keyed by node ID), not an array. The backend calls `graph.PopulateNodeIDs()` after unmarshal to make node IDs available from map keys.

Full field reference: [graph_json.md](../../agent_layer/graph_json.md)

---

## SSE Run Streaming

Use the browser's native `EventSource` — but note `EventSource` doesn't support custom headers (no Bearer token). Use `fetch` with `ReadableStream` instead:

```typescript
async function streamRunEvents(runId: string, token: string, onEvent: (e: SSEEvent) => void) {
  const res = await fetch(`/api/v1/orchestrator/runs/${runId}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop()!;
    for (const raw of events) {
      if (!raw.trim()) continue;
      const lines = raw.split('\n');
      const typeLine = lines.find(l => l.startsWith('event:'));
      const dataLine = lines.find(l => l.startsWith('data:'));
      if (typeLine && dataLine) {
        onEvent({
          type: typeLine.replace('event:', '').trim(),
          data: JSON.parse(dataLine.replace('data:', '').trim()),
        });
      }
    }
  }
}
```

**Terminal events** (stream ends after these): `RunCompleted`, `RunFailed`, `RunCancelled`

**Event types:**
| Event | Data |
|---|---|
| `RunCreated` | `{ run_id, status }` |
| `RunStarted` | `{}` |
| `NodeStarted` | `{ node_id }` |
| `NodeCompleted` | `{ node_id }` |
| `AgentStarted` | `{ agent_id }` |
| `AgentStepStarted` | `{ iteration }` |
| `token` | `{ content, node_id, node_run_id }` |
| `AgentStepCompleted` | `{ iteration, finish_reason }` |
| `ToolCallCompleted` | `{ tool_name, output }` |
| `AgentCompleted` | `{}` |
| `HumanReviewRequested` | `{ task_id, run_id, node_run_id }` |
| `RunCompleted` | `{}` |
| `RunFailed` | `{ error }` |

---

## Human Review Flow (UI)

```
1. Listen on SSE stream → receive HumanReviewRequested { task_id }
2. Show review panel to human with the run's input/context
3. Human clicks Approve/Reject
4. POST /api/v1/orchestrator/runs/{run_id}/resume
   Body: { task_id, output: { decision: "approved", notes: "..." } }
5. SSE stream resumes automatically with NodeCompleted and continues
```

To show a dashboard of runs awaiting review:
```
GET /api/v1/orchestrator/runs/pending-review
→ { items: [RunResponse, ...] }
```

---

## CORS

Agent Studio needs CORS configured for the frontend origin. Add to `application.properties`:
```properties
app.cors.allowed-origins=${CORS_ORIGINS:http://localhost:5173}
```

And add a `CorsConfig.java` bean (not yet implemented — needed before FE integration).

---

## What's Ready vs What's Needed for FE

| Area | Backend | Frontend |
|---|---|---|
| Auth (login/logout/refresh) | ✅ Ready | ✅ Implemented |
| Multi-workspace switch | ✅ Ready | ✅ Implemented |
| Agent CRUD | ✅ Ready | ✅ Implemented |
| Tool CRUD | ✅ Ready | ✅ Implemented |
| Flow canvas — all node types | ✅ Ready | ✅ Implemented |
| Flow publish (with validation) | ✅ Ready | ✅ Implemented |
| Thread management | ✅ Ready | ✅ Implemented |
| Run creation + SSE stream | ✅ Ready | ✅ Implemented |
| Human review panel | ✅ Ready | ✅ Implemented |
| AIHub model/provider config | ✅ Ready | ✅ Implemented |
| DataHub datasource/document/ingestion | ✅ Ready | ✅ Implemented |
| DataHub DLQ admin (list/replay/clear) | ✅ Ready | ✅ Implemented |
| Platform — tenant/feature/model entitlements | ✅ Ready | ✅ Implemented |
| CORS config | ⚠️ Needs `CorsConfig.java` | — |
