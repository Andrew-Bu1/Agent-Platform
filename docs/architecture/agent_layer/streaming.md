# Agent Layer — SSE Streaming Architecture

## Design Principle

Run creation and event streaming are **two separate steps**:

1. `POST /runs` — creates the run, starts the engine in the background, returns `201 JSON` with the initial `RunResponse`.
2. `GET /runs/{id}/events` — opens an SSE stream for the run. Works for both the initial connection right after creation and reconnects after a disconnect.

This separation allows the client to get the run ID reliably (even if the SSE connection drops immediately) and reconnect without losing structural events.

---

## Redis Pub/Sub Channel

Every run has one Pub/Sub channel:

```
run:{run_id}:stream
```

Two processes publish to it:

| Publisher | Events |
|---|---|
| **Orchestrator Engine** | `RunStarted`, `NodeStarted`, `NodeCompleted`, `NodeFailed`, `RunCompleted`, `RunFailed`, `RunCancelled` |
| **Agent Worker** | `AgentStarted`, `AgentStepStarted`, `AgentStepCompleted`, `ToolCallStarted`, `ToolCallCompleted`, `AgentCompleted`, `HumanReviewRequested`, `token` (high frequency) |

The agent worker publishes all agent-level events **in real-time during execution** (not after the fact via `NodeResult`). The orchestrator only persists these events to DB for the reconnect/replay path — it does **not** re-publish them to the Pub/Sub channel.

All messages are JSON-encoded `SSEEvent` objects:

```json
{"type": "token", "data": {"content": "Hello", "node_id": "n1", "node_run_id": "..."}}
{"type": "NodeCompleted", "data": {"node_id": "n1"}}
{"type": "RunCompleted", "data": {}}
```

---

## Two-Step Flow

### Step 1 — POST /runs (Create Run)

```
Client                  Orchestrator                     Background
  │                          │
  │─ POST /runs ────────────►│
  │                          │─ INSERT run (DB)
  │                          │─ start Engine goroutine (context.Background())
  │◄── HTTP 201 JSON ────────│  {success:true, data:{id, status:"pending", ...}}
```

### Step 2 — GET /runs/{id}/events (SSE Stream)

```
Client                  Orchestrator                     Redis Pub/Sub          Agent Worker
  │                          │                                │                      │
  │─ GET /runs/{id}/events ─►│                                │                      │
  │                          │─ replay DB events (if any) ───►│                      │
  │                          │─ SUBSCRIBE run:{id}:stream ───►│                      │
  │◄── HTTP 200 (SSE) ───────│                                │                      │
  │                          │── PUBLISH RunStarted ─────────►│                      │
  │◄── event: RunStarted ────│◄──────────────────────────────│                      │
  │                          │── PUBLISH NodeStarted ─────────►│                      │
  │◄── event: NodeStarted ───│◄──────────────────────────────│                      │
  │                          │── RPUSH NodeJob ────────────────────────────────────►│
  │                          │                                │◄── PUBLISH AgentStarted│
  │◄── event: AgentStarted ──│◄──────────────────────────────│                      │
  │                          │                                │◄── PUBLISH token ────│
  │◄── event: token ─────────│◄──────────────────────────────│ (many)               │
  │                          │                                │◄── PUBLISH AgentCompleted
  │◄── event: AgentCompleted │◄──────────────────────────────│                      │
  │                          │                      ◄── RPUSH NodeResult ────────────│
  │                          │── PUBLISH NodeCompleted ───────►│                      │
  │◄── event: NodeCompleted ─│◄──────────────────────────────│                      │
  │                          │── PUBLISH RunCompleted ─────────►│                      │
  │◄── event: RunCompleted ──│◄──────────────────────────────│                      │
  │                          │                                │                      │
  │   (SSE stream closes)    │                                │                      │
```

### Internal goroutines per SSE stream (GET /runs/{id}/events)

```
GET /runs/{id}/events handler
│
├─ WatchRun()
│   ├─ DB: replay run_events WHERE sequence_no > Last-Event-ID
│   ├─ Redis: SUBSCRIBE run:{id}:stream
│   └─ go bridge(ctx, pubsub, doneCh)
│       reads pubsub.Channel() → writes eventCh
│       exits when: ctx cancelled | doneCh fires + 300ms drain | redisCh closed
│
└─ handler: reads eventCh → writes SSE to ResponseWriter
    exits when: eventCh closed | r.Context().Done()
```

**POST /runs (`CreateRun`)** inserts the run, starts the engine goroutine on `context.Background()`, and returns immediately with the run JSON. The engine goroutine is independent of any HTTP connection.

**Client disconnect on GET /events**: if the client drops the SSE connection, `r.Context()` is cancelled, the bridge goroutine exits, pubsub is unsubscribed. The engine goroutine keeps running — the run completes in the background.

---

## Reconnect Stream (GET /runs/{id}/events)

Used when the client reconnects after a disconnect. Sends the `Last-Event-ID` header with the last `sequence_no` received to avoid replaying old events.

```
GET /runs/{id}/events
Last-Event-ID: 42

Response (text/event-stream):
  ← replay DB events with sequence_no > 42
  ← live events via Pub/Sub
  ← stream ends when run reaches terminal status
```

### Key difference from token events

Structural events (`NodeStarted`, `RunCompleted`, etc.) are persisted to the `run_events` DB table with a monotonically increasing `sequence_no`. They are replayable.

`token` events are **not** persisted to DB. If the client reconnects, tokens from before the reconnect are lost. Only structural events are replayed.

---

## SSE Event Reference

All events use the format:

```
event: <EventType>
data: <JSON payload>

```

### Structural events (persisted in run_events)

| Event | Payload | Description |
|---|---|---|
| `RunCreated` | `{run_id, status}` | Sent immediately after DB insert (pre-stream) |
| `RunStarted` | `{}` | Engine started, run is now `running` |
| `NodeStarted` | `{node_id}` | Node dispatched (worker or inline) |
| `NodeCompleted` | `{node_id}` | Node result received and processed |
| `NodeFailed` | `{node_id}` | Node returned error status |
| `RunCompleted` | `{}` | All nodes done, run `completed` |
| `RunFailed` | `{error}` | Unrecoverable error, run `failed`. `error` is a properly JSON-marshaled string (safe for any error message content) |
| `HumanReviewRequested` | `{task_id, run_id, node_run_id}` | Run paused at human_review node |

### Worker events (persisted in run_events)

| Event | Payload | Description |
|---|---|---|
| `AgentStarted` | `{agent_id}` | Agent loaded, ReAct loop begins |
| `AgentStepStarted` | `{iteration}` | Iteration N of the ReAct loop |
| `AgentStepCompleted` | `{iteration, finish_reason}` | LLM response assembled for this iteration |
| `ToolCallStarted` | `{tool_call_id, tool}` | Tool execution begun (published **before** the call) |
| `ToolCallCompleted` | `{tool_call_id, tool, error}` | Tool call finished; `error: true` if it failed |
| `AgentCompleted` | `{}` | Agent done, no more tool calls |
| `HumanReviewRequested` | `{task_id, run_id, node_run_id}` | Run paused; human input required |

### Token events (not persisted — ephemeral)

| Event | Payload | Description |
|---|---|---|
| `token` | `{content, node_id, node_run_id}` | A single LLM token delta |

---

## Iteration Guard

Each node tracks how many times it has been dispatched in `RunState.NodeIterations`.  
If any node exceeds **25 iterations**, the engine calls `failRun` immediately.  
This prevents self-correct loops from running indefinitely.

---

## Inline Nodes — No Worker Events

`start`, `end`, `if_else`, `router`, and `parallel` are handled directly in the engine goroutine without dispatching a job to the worker queue. They emit only:

- `NodeStarted` (before resolution)
- `NodeCompleted` (immediately after)

No `AgentStarted`, `token`, or other worker events appear for these node types.

---

## Key Design Constraints

| Constraint | Reason |
|---|---|
| Subscribe to Pub/Sub BEFORE sending SSE headers | Prevents missing events published between subscribe and stream open |
| Engine runs on `context.Background()` | Run survives client disconnect — completes in background |
| Bridge goroutine uses request context | Cleans up pub/sub when client disconnects from `GET /events` |
| 300 ms drain after engine done | Allows in-flight pub/sub messages to arrive before closing eventCh |
| Token events not persisted to DB | Volume too high; they are ephemeral delivery only |
| `POST /runs` returns JSON, not SSE | Lets the client get a stable run ID even if the SSE connection fails immediately |
| `graph.PopulateNodeIDs()` called after unmarshal | `nodes` is a map keyed by ID; Go needs an explicit step to copy keys into `GraphNode.ID` |
