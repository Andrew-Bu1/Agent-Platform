# Agent Layer — SSE Streaming Architecture

## Design Principle

A single `POST /runs` request both **creates** the run and **streams** all events back to the client.  
There is no separate subscription step. The client receives a `text/event-stream` response immediately and reads events until the stream closes (run terminal) or the client disconnects.

---

## Redis Pub/Sub Channel

Every run has one Pub/Sub channel:

```
run:{run_id}:stream
```

Two processes publish to it:

| Publisher | Events |
|---|---|
| **Orchestrator Engine** | `RunStarted`, `NodeStarted`, `NodeCompleted`, `RunCompleted`, `RunFailed`, `AgentStarted`, `AgentStepStarted`, `AgentStepCompleted`, `ToolCallCompleted`, `AgentCompleted`, `HumanReviewRequested` |
| **Agent Worker** | `token` (one per LLM token delta, high frequency) |

All messages are JSON-encoded `SSEEvent` objects:

```json
{"type": "token", "data": {"content": "Hello", "node_id": "n1", "node_run_id": "..."}}
{"type": "NodeCompleted", "data": {"node_id": "n1"}}
{"type": "RunCompleted", "data": {}}
```

---

## Live Stream (POST /runs)

```
Client                  Orchestrator                     Redis Pub/Sub          Agent Worker
  │                          │                                │                      │
  │─ POST /runs ────────────►│                                │                      │
  │                          │─ INSERT run ──────────────────►│ (DB, not shown)      │
  │                          │─ SUBSCRIBE run:{id}:stream ───►│                      │
  │                          │─ start Engine goroutine        │                      │
  │◄── HTTP 200 (SSE) ───────│                                │                      │
  │◄── event: RunCreated ────│                                │                      │
  │                          │── PUBLISH RunStarted ─────────►│                      │
  │◄── event: RunStarted ────│◄──────────────────────────────│                      │
  │                          │── PUBLISH NodeStarted ─────────►│                      │
  │◄── event: NodeStarted ───│◄──────────────────────────────│                      │
  │                          │── RPUSH NodeJob ────────────────────────────────────►│
  │                          │                                │◄── PUBLISH token ────│
  │◄── event: token ─────────│◄──────────────────────────────│ (many)               │
  │                          │                                │◄── PUBLISH token ────│
  │◄── event: token ─────────│◄──────────────────────────────│                      │
  │                          │                      ◄── RPUSH NodeResult ────────────│
  │                          │── PUBLISH NodeCompleted ───────►│                      │
  │◄── event: NodeCompleted ─│◄──────────────────────────────│                      │
  │                          │── PUBLISH RunCompleted ─────────►│                      │
  │◄── event: RunCompleted ──│◄──────────────────────────────│                      │
  │                          │                                │                      │
  │   (SSE stream closes)    │                                │                      │
```

### Internal goroutines per live stream

```
POST /runs handler
│
├─ CreateAndStream()
│   ├─ DB: insert run
│   ├─ Redis: SUBSCRIBE run:{id}:stream         ← pubsub handle
│   ├─ go eng.Run(ctx.Background())             ← engine goroutine (outlives HTTP request)
│   └─ go bridge(ctx, pubsub, eng.DoneCh())    ← bridge goroutine
│       reads pubsub.Channel() → writes eventCh
│       exits when: ctx cancelled | DoneCh fires + 300ms drain | redisCh closed
│
└─ handler: reads eventCh → writes SSE to ResponseWriter
    exits when: eventCh closed | r.Context().Done()
```

**Client disconnect**: if the client drops the connection, the handler's `r.Context()` is cancelled, the bridge goroutine exits (closing eventCh), pubsub is unsubscribed. The engine goroutine keeps running unaffected — the run completes normally in the background.

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
| `RunFailed` | `{error}` | Unrecoverable error, run `failed` |
| `HumanReviewRequested` | `{task_id, run_id, node_run_id}` | Run paused at human_review node |

### Worker events (persisted in run_events)

| Event | Payload | Description |
|---|---|---|
| `AgentStarted` | `{agent_id}` | Agent loaded, ReAct loop begins |
| `AgentStepStarted` | `{iteration}` | Iteration N of the ReAct loop |
| `AgentStepCompleted` | `{iteration, finish_reason}` | LLM response assembled |
| `ToolCallCompleted` | `{tool_call_id, tool, error}` | A tool call finished |
| `AgentCompleted` | `{}` | Agent done, no more tool calls |

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

## Key Design Constraints

| Constraint | Reason |
|---|---|
| Subscribe to Pub/Sub BEFORE starting engine | Prevents missing events published between engine start and subscription |
| Engine runs on `context.Background()` | Run survives client disconnect — completes in background |
| Bridge goroutine uses request context | Cleans up pub/sub when client disconnects |
| 300 ms drain after engine done | Allows in-flight pub/sub messages to arrive before closing eventCh |
| Token events not persisted to DB | Volume too high; they are ephemeral delivery only |
