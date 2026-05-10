# Agent Layer — API Reference

Base path: `/` (agent-orchestrator service)  
All endpoints require `Authorization: Bearer <access_token>`.  
JWT claims must include `tenant_id` and `workspace_id`.

> **Frontend access:** The frontend does **not** call the orchestrator directly.  
> All orchestrator endpoints are proxied through agent-studio at `/api/v1/orchestrator/*`.

---

## Threads

A thread groups multiple runs into a conversation/session context. The agent worker can load thread history when a run specifies a `thread_id`.

### POST /threads

Create a new thread.

**Request body:**
```json
{
  "title": "optional string",
  "metadata": {}
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "workspace_id": "uuid",
  "user_id": "uuid (from JWT sub, nullable)",
  "title": "string",
  "metadata": {},
  "created_at": "RFC3339",
  "updated_at": "RFC3339"
}
```

### GET /threads

List threads for the caller's workspace (paginated).

**Query params:** `limit` (default 20, max 100), `offset` (default 0)

**Response (200):**
```json
{"items": [ ...ThreadResponse... ]}
```

### GET /threads/{id}

Get a single thread.

**Response (200):** `ThreadResponse`

### GET /threads/{id}/runs

List runs attached to this thread (paginated).

**Query params:** `limit`, `offset`

**Response (200):**
```json
{"items": [ ...RunResponse... ]}
```

---

## Runs

### GET /runs/pending-review

Returns all runs with `status = waiting_for_human` in the caller's workspace. Used by the review dashboard in the UI.

**Response (200):**
```json
{"items": [ ...RunResponse... ]}
```

---

## POST /runs

Creates a new flow run and immediately streams all events as Server-Sent Events.

**Request body:**
```json
{
  "flow_version_id": "uuid",
  "thread_id": "uuid (optional — attaches conversation history)",
  "input": {}
}
```

**Validation:**
- `flow_version_id` must exist, belong to the caller's tenant/workspace, and have `status=published`
- `thread_id` is optional; if supplied, the agent worker loads message history from that thread

**Response:** `200 text/event-stream`

The first event is always `RunCreated`. Events stream until `RunCompleted` or `RunFailed`, then the connection closes.

```
event: RunCreated
data: {"run_id":"<uuid>","status":"pending"}

event: RunStarted
data: {}

event: NodeStarted
data: {"node_id":"start"}

event: NodeCompleted
data: {"node_id":"start"}

event: NodeStarted
data: {"node_id":"agent-1"}

event: AgentStarted
data: {"agent_id":"<uuid>"}

event: AgentStepStarted
data: {"iteration":1}

event: token
data: {"content":"Hello","node_id":"agent-1","node_run_id":"<uuid>"}

... more token events ...

event: AgentStepCompleted
data: {"iteration":1,"finish_reason":"stop"}

event: AgentCompleted
data: {}

event: NodeCompleted
data: {"node_id":"agent-1"}

event: RunCompleted
data: {}
```

**Error before stream starts:** returns JSON `{"error":"..."}` with appropriate HTTP status.

---

## GET /runs/{id}

Returns the current snapshot of a run (non-streaming).

**Response (200):**
```json
{
  "id": "uuid",
  "flow_version_id": "uuid",
  "thread_id": "uuid",
  "status": "running | completed | failed | waiting_for_human | cancelled",
  "input_json": {},
  "output_json": {},
  "error_json": {},
  "started_at": "RFC3339",
  "finished_at": "RFC3339",
  "created_at": "RFC3339"
}
```

---

## GET /runs/{id}/events

Reconnect endpoint. Streams SSE events for an existing run.

Replay historical structural events first (from `run_events` DB table), then forward live events via Redis Pub/Sub.

**Reconnect from last received event:**
```
GET /runs/{run_id}/events
Last-Event-ID: 42
```

Replays all events with `sequence_no > 42`. If omitted, replays all events from the beginning.

> **Note:** `token` events are not persisted to DB and are not replayed on reconnect.

**Response:** `200 text/event-stream` — same event format as `POST /runs`.

---

## POST /runs/{id}/cancel

Cancels an active run.

**Response (200):**
```json
{"status": "cancelled"}
```

Only valid for runs with status `pending`, `running`, or `waiting_for_human`.

---

## POST /runs/{id}/resume

Resumes a run paused at a `human_review` node.

**Request body:**
```json
{
  "task_id": "uuid",
  "output": {
    "decision": "approved",
    "notes": "optional free-form reviewer data"
  }
}
```

- `task_id` must match the task ID from the `HumanReviewRequested` SSE event
- `output` becomes the `output_json` for the human_review node_run and the input to the next node

**Response (200):**
```json
{"status": "resumed"}
```

---

## Node Types

| Type | Handled by | Description |
|---|---|---|
| `start` | Orchestrator (inline) | Entry point; passes input through |
| `end` | Orchestrator (inline) | Terminal; output from last node |
| `if_else` | Orchestrator (inline) | Evaluates expression → `true`/`false` edge |
| `router` | Orchestrator (inline) | Routes by `output.route` field → labelled edge |
| `parallel` | Orchestrator (inline) | Fans out to all outgoing edges simultaneously |
| `aggregator` | Orchestrator (inline) | Waits for all parallel branches; merges outputs |
| `agent` | Agent Worker | Runs a ReAct loop via AIHub |
| `agent_team` | Agent Worker | Hierarchical supervisor/worker agent team |
| `human_review` | Agent Worker | Pauses run; waits for `POST /runs/{id}/resume` |

---

## Flow Patterns Supported

| Pattern | How it's built |
|---|---|
| Sequential | Linear edges: `start → agent-A → agent-B → end` |
| Parallel fan-out | `parallel` node → multiple branches → `aggregator` node |
| Hierarchical (supervisor) | `agent_team` node (single worker dispatch, multi-agent internally) |
| Self-correct loop | `agent` → `if_else` → back-edge to `agent` (max 25 iterations) |
