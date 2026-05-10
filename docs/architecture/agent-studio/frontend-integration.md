# Frontend Integration Guide

**Last updated:** 2026-05-10

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
  "agentKind": "single | team",
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

### IAM — Tenant Management (`/api/v1/tenants`)

```
GET|POST              /api/v1/tenants
GET|PUT               /api/v1/tenants/{id}
GET|POST              /api/v1/tenants/{id}/members
DELETE|PUT            /api/v1/tenants/{id}/members/{uid}[/role]
GET|POST              /api/v1/tenants/{id}/workspaces
GET|PUT               /api/v1/tenants/{id}/workspaces/{wid}
GET|POST              /api/v1/tenants/{id}/workspaces/{wid}/members
DELETE|PUT            /api/v1/tenants/{id}/workspaces/{wid}/members/{uid}[/role]
```

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
| Auth (login/logout/refresh) | ✅ Ready | ⬜ Implement |
| Multi-workspace switch | ✅ Ready | ⬜ Implement |
| Agent CRUD | ✅ Ready | ⬜ Implement |
| Tool CRUD | ✅ Ready | ⬜ Implement |
| Flow canvas | ✅ Ready | ⬜ Implement |
| Flow publish (with validation) | ✅ Ready | ⬜ Implement |
| Thread management | ✅ Ready | ⬜ Implement |
| Run creation + SSE stream | ✅ Ready | ⬜ Implement |
| Human review panel | ✅ Ready | ⬜ Implement |
| AIHub model/provider config | ✅ Ready | ⬜ Implement |
| DataHub datasource/document | ✅ Ready | ⬜ Implement |
| CORS config | ⚠️ Needs `CorsConfig.java` | — |
