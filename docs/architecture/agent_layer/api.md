# Agent Layer — API Reference

Base path: `/` (agent-orchestrator service)  
All endpoints require `Authorization: Bearer <access_token>`.  
JWT claims must include `tenant_id` and `workspace_id`.

> **Frontend access:** The frontend does **not** call the orchestrator directly.  
> All orchestrator endpoints are proxied through agent-studio at `/api/v1/orchestrator/*`.

---

## Response Envelope

All JSON responses are wrapped in a standard envelope:

**Success:**
```json
{"success": true, "data": { ... }}
```

**Error:**
```json
{"success": false, "error": "BAD_REQUEST", "message": "human-readable description"}
```

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL`.

SSE endpoints (`GET /runs/{id}/events`) are exempt — they respond with `text/event-stream` directly.

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
  "tenantId": "uuid",
  "workspaceId": "uuid",
  "userId": "uuid (from JWT sub, nullable)",
  "title": "string",
  "metadata": {},
  "createdAt": "RFC3339",
  "updatedAt": "RFC3339"
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

### GET /runs

Returns a paginated list of all runs in the caller's workspace, ordered by `created_at DESC`.

**Query params:** `page` (default 0), `size` (default 20)

**Response (200):**
```json
{
  "content": [ ...RunResponse... ],
  "totalElements": 42,
  "totalPages": 3,
  "number": 0,
  "size": 20
}
```

### GET /runs/pending-review

Returns all runs with `status = waiting_for_human` in the caller's workspace. Used by the review dashboard in the UI. Ordered by `created_at ASC` (oldest first).

> **Owner:** `RunHandler`. This route is registered only in `RunHandler.RegisterRoutes` — do not also register it in `ThreadHandler`.

**Response (200):**
```json
[ ...RunResponse... ]
```

---

## POST /runs

Creates a new flow run and returns the initial run snapshot as JSON. The run engine starts in the background immediately.

To receive real-time events, open `GET /runs/{id}/events` after getting the run ID from this response.

**Request body:**
```json
{
  "flowVersionId": "uuid",
  "threadId": "uuid (optional — attaches conversation history)",
  "input": {}
}
```

**Validation:**
- `flowVersionId` must exist, belong to the caller's tenant/workspace, and have `status=published`
- `threadId` is optional; if supplied, the agent worker loads message history from that thread

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "flowVersionId": "uuid",
    "threadId": "uuid | null",
    "status": "pending",
    "input": {},
    "output": null,
    "error": null,
    "startedAt": null,
    "finishedAt": null,
    "createdAt": "RFC3339",
    "updatedAt": "RFC3339",
    "humanWaitTaskId": null
  }
}
```

> **Typical client flow:** `POST /runs` → receive `{success, data: {id}}` → open `GET /runs/{id}/events` to stream SSE events.

---

## GET /runs/{id}

Returns the current snapshot of a run (non-streaming).

**Response (200):**
```json
{
  "id": "uuid",
  "flowVersionId": "uuid",
  "threadId": "uuid | null",
  "status": "pending | running | completed | failed | waiting_for_human | cancelled",
  "input": {},
  "output": {},
  "error": {},
  "startedAt": "RFC3339 | null",
  "finishedAt": "RFC3339 | null",
  "createdAt": "RFC3339",
  "updatedAt": "RFC3339",
  "humanWaitTaskId": "uuid | null (only when status=waiting_for_human)"
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

## GET /runs/{id}/node-runs

Returns all node-level execution steps for a run, ordered by `created_at ASC`.

Each row corresponds to one invocation of a graph node during the run. A node may appear more than once if it was iterated (loop) or retried (`attempt_no > 0`).

**Response (200):**
```json
[
  {
    "id": "uuid",
    "run_id": "uuid",
    "node_id": "agent-1",
    "node_type": "agent",
    "node_name": "Research Agent",
    "status": "completed",
    "branch_key": "",
    "iteration": 0,
    "attempt_no": 0,
    "input_json": { "message": "..." },
    "output_json": { "result": "..." },
    "error_json": null,
    "started_at": "RFC3339 | null",
    "finished_at": "RFC3339 | null",
    "created_at": "RFC3339"
  }
]
```

**`status` values:** `pending` | `running` | `completed` | `failed`

**`branch_key`** is set for `if_else` and `router` nodes to indicate which branch was taken (`"true"`, `"false"`, or a custom route label). Empty string for all other node types.

**`iteration`** is incremented each time the same node is dispatched within a run (loop detection path). Zero-indexed.

**`attempt_no`** is incremented on retry within a single iteration. Zero-indexed.

Returns an empty array `[]` if no steps have been recorded yet (run is still `pending`).

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
| `start` | Orchestrator (inline) | Entry point; passes `run.input_json` through unchanged |
| `end` | Orchestrator (inline) | Terminal; input becomes `run.output_json` |
| `if_else` | Orchestrator (inline) | Evaluates `data.ifExpression` against previous output → routes `"true"` or `"false"` edge |
| `router` | Orchestrator (inline) | Routes by `output.route` string → matching edge label; falls back to `"default"` |
| `parallel` | Orchestrator (inline) | Fires all outgoing edges simultaneously; completes immediately |
| `aggregator` | Agent Worker | Waits for all incoming parallel branches; receives merged input keyed by source node ID |
| `agent` | Agent Worker | Runs a ReAct loop via AIHub; config: `{ agentId, modelId?, maxIterations? }` |
| `agent_team` | Agent Worker | Supervisor-handoff team; the supervisor LLM decides at runtime which member agent to delegate to; config: `{ agentId (supervisor), memberAgentIds, exitAgentId?, maxIterations? }` |
| `human_review` | Agent Worker | Pauses run; publishes `HumanReviewRequested`; resumes on `POST /runs/{id}/resume` |

See [graph_json.md](./graph_json.md) for the full node schema and `data` field reference.

---

## Flow Patterns Supported

| Pattern | How it's built |
|---|---|
| **1. Sequential** | Linear edges: `start → agent-A → agent-B → end` |
| **2. Parallel fan-out** | `parallel` node → multiple `agent` branches → `aggregator` node |
| **3. Supervisor handoff** | Single `agent_team` node; supervisor LLM decides which member agent to call next at runtime — no predefined wiring |
| **4. Self-correct loop** | `agent` → `if_else` → `"false"` back-edge to `agent` (guarded at 25 iterations) |
| **Human-in-the-loop** | Insert `human_review` anywhere; run pauses until `POST /runs/{id}/resume` |
