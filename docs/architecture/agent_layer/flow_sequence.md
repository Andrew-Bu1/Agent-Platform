# Agent Layer — Run Execution Sequence

An agent run is created with a single `POST /runs` request.  
The response is an **SSE stream** that delivers all events in real-time until the run terminates.  
No separate GET is needed to start listening.

---

## Happy Path — Single Agent Node

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant OR as Orchestrator<br/>POST /runs
    participant PG as PostgreSQL
    participant Redis as Redis<br/>(Queue + Pub/Sub)
    participant WK as Agent Worker
    participant AIH as AIHub<br/>POST /v1/chat/completions

    C->>OR: POST /runs {flow_version_id, input}<br/>Authorization: Bearer <access_token>
    OR->>PG: SELECT flow_versions WHERE id=$id AND status='published'
    PG-->>OR: flow_version row (graph_json)

    OR->>PG: INSERT runs {id, status=pending, input_json, state_json}
    PG-->>OR: run row

    Note over OR,Redis: Subscribe BEFORE starting engine — no early events missed
    OR->>Redis: SUBSCRIBE run:{run_id}:stream

    Note over OR: Engine goroutine starts (background)
    OR-->>C: HTTP 200 text/event-stream<br/>event: RunCreated<br/>data: {"run_id":"...", "status":"pending"}

    OR->>PG: UPDATE runs SET status='running', started_at=NOW()
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"RunStarted"}
    OR-->>C: event: RunStarted<br/>data: {}

    Note over OR,Redis: Engine dispatches each node to the worker queue
    OR->>PG: INSERT node_runs {id, node_id, status='running', iteration=1}
    OR->>Redis: RPUSH agent:queue:node → NodeJob{run_id, node_run_id, node_config, input_json}
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"NodeStarted"}
    OR-->>C: event: NodeStarted<br/>data: {"node_id":"..."}

    Redis-->>WK: BLPOP NodeJob

    WK->>AIH: POST /v1/chat/completions {model, messages, stream:true}
    AIH-->>WK: SSE token stream

    loop for each token
        WK->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"token", data:{content:"...", node_run_id:"..."}}
        Redis-->>OR: message on subscribed channel
        OR-->>C: event: token<br/>data: {"content":"Hello", "node_run_id":"..."}
    end

    Note over WK: Stream ends — assemble final message, check for tool calls
    WK->>Redis: RPUSH agent:queue:event → NodeResult{run_id, node_run_id, status="completed", output_json}

    OR->>OR: Engine receives NodeResult via Dispatcher
    OR->>PG: UPDATE node_runs SET status='completed', output_json=$out
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"NodeCompleted"}
    OR-->>C: event: NodeCompleted<br/>data: {"node_id":"..."}

    Note over OR: All PendingNodes empty → run complete
    OR->>PG: UPDATE runs SET status='completed', output_json=$out, finished_at=NOW()
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"RunCompleted"}
    OR-->>C: event: RunCompleted<br/>data: {}

    Note over OR,C: Bridge goroutine closes eventCh → SSE stream ends
```

---

## Multi-Node Flow (Sequential)

Each node completes before the next is dispatched. The engine advances via outgoing edges.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant OR as Orchestrator (Engine)
    participant Redis as Redis
    participant WK as Agent Worker

    Note over C,OR: POST /runs → SSE stream opened (same as above)

    OR->>OR: dispatchNode(start)  — inline, no worker
    OR-->>C: event: NodeStarted / NodeCompleted (start node)

    OR->>Redis: RPUSH → NodeJob for node-A
    OR-->>C: event: NodeStarted (node-A)

    Redis-->>WK: NodeJob (node-A)
    WK-->>Redis: NodeResult (node-A, completed)

    OR->>Redis: RPUSH → NodeJob for node-B
    OR-->>C: event: NodeCompleted (node-A)<br/>event: NodeStarted (node-B)

    Redis-->>WK: NodeJob (node-B)
    WK-->>Redis: NodeResult (node-B, completed)

    OR-->>C: event: NodeCompleted (node-B)<br/>event: NodeCompleted (end node)<br/>event: RunCompleted
```

---

## Parallel Fan-Out + Aggregator

```mermaid
sequenceDiagram
    autonumber
    participant OR as Orchestrator (Engine)
    participant Redis as Redis
    participant WK as Agent Worker

    OR->>OR: dispatchNode(parallel) — inline, registers ParallelWaiting counter
    OR->>Redis: RPUSH → NodeJob(branch-A)
    OR->>Redis: RPUSH → NodeJob(branch-B)

    Note over OR,Redis: Both branches run concurrently in separate worker goroutines

    Redis-->>WK: NodeJob(branch-A)
    Redis-->>WK: NodeJob(branch-B)
    WK-->>Redis: NodeResult(branch-A)
    WK-->>Redis: NodeResult(branch-B)

    Note over OR: Each result decrements ParallelWaiting[aggregator_id]
    Note over OR: When counter reaches 0 — dispatch aggregator

    OR->>OR: buildAggregatedInput → merge branch outputs
    OR->>Redis: RPUSH → NodeJob(aggregator)
```

---

## Self-Correct Loop (if_else back-edge)

The `NodeIterations` counter (max 25) prevents runaway loops.

```mermaid
sequenceDiagram
    autonumber
    participant OR as Orchestrator (Engine)
    participant Redis as Redis
    participant WK as Agent Worker

    OR->>Redis: RPUSH → NodeJob(generate, iteration=1)
    Redis-->>WK: NodeJob
    WK-->>Redis: NodeResult(output_json)

    OR->>Redis: RPUSH → NodeJob(review, iteration=1)
    Redis-->>WK: NodeJob
    WK-->>Redis: NodeResult({route:"retry"} or {route:"accept"})

    alt route == "retry" (back-edge to generate)
        OR->>Redis: RPUSH → NodeJob(generate, iteration=2)
        Note over OR: NodeIterations["generate"] = 2
    else route == "accept"
        OR->>OR: advanceFrom(review) → end node
    end

    Note over OR: Guard: iteration > 25 → failRun("node exceeded max iterations")
```

---

## Worker Events Emitted During a Node Run

These appear as SSE events between `NodeStarted` and `NodeCompleted`:

| Event | When |
|---|---|
| `AgentStarted` | Agent loaded, ReAct loop begins |
| `AgentStepStarted` | Each ReAct iteration starts |
| `token` | Each LLM text token (high frequency) |
| `AgentStepCompleted` | LLM response assembled (finish_reason, iteration) |
| `ToolCallCompleted` | Each tool call finishes |
| `AgentCompleted` | Agent produced final output with no further tool calls |

---

## Run Status Lifecycle

```
pending → running → completed
                 ↘
                   failed
                 ↘
                   waiting_for_human → running → completed
                                               ↘ failed
                 ↘
                   cancelled
```

| Status | Set by | Condition |
|---|---|---|
| `pending` | Orchestrator API | On `POST /runs` |
| `running` | Engine | `SetStarted` at loop start |
| `waiting_for_human` | Engine | `HumanReviewRequested` event received |
| `completed` | Engine | All PendingNodes empty |
| `failed` | Engine | Any unrecoverable error |
| `cancelled` | API | `POST /runs/{id}/cancel` |
