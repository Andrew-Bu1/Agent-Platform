# Agent Layer — Run Execution Sequence

An agent run is created with `POST /runs`, which returns a JSON `RunResponse`.  
The client then opens `GET /runs/{id}/events` to receive all execution events as an SSE stream.

---

## Happy Path — Single Agent Node

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant OR as Orchestrator
    participant PG as PostgreSQL
    participant Redis as Redis<br/>(Queue + Pub/Sub)
    participant WK as Agent Worker
    participant AIH as AIHub<br/>POST /v1/chat/completions

    C->>OR: POST /runs {flowVersionId, input}<br/>Authorization: Bearer <access_token>
    OR->>PG: SELECT flow_versions WHERE id=$id AND status='published'
    PG-->>OR: flow_version row (graph_json)

    OR->>PG: INSERT runs {id, status=pending, input_json, state_json}
    PG-->>OR: run row

    Note over OR: DispatchEntry — sets status=running, pushes entry NodeJob to Redis (no goroutine)
    OR-->>C: HTTP 201 JSON {success:true, data:{id, status:"pending", ...}}

    Note over C,OR: Client opens SSE stream
    C->>OR: GET /runs/{id}/events
    OR->>Redis: SUBSCRIBE run:{run_id}:stream
    OR-->>C: HTTP 200 text/event-stream

    OR->>PG: UPDATE runs SET status='running', started_at=NOW()
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"RunStarted"}
    OR-->>C: event: RunStarted<br/>data: {}

    Note over OR,Redis: Entry node job is in queue — Dispatcher goroutine picks it up
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
    WK->>Redis: RPUSH agent:queue:event → NodeResult{run_id, node_run_id, tenant_id, status="completed", output_json}

    Note over OR: Dispatcher.advance — loads run+graph+state from DB, creates short-lived Engine, calls Advance()
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

    Note over C,OR: POST /runs → 201 JSON; client opens GET /runs/{id}/events (SSE)

    OR->>OR: dispatchNode(start)  — inline, no worker
    OR-->>C: event: NodeStarted / NodeCompleted (start node)

    OR->>Redis: RPUSH → NodeJob for node-A
    OR-->>C: event: NodeStarted (node-A)

    Redis-->>WK: NodeJob (node-A)
    WK-->>Redis: NodeResult (node-A, completed, tenant_id)

    OR->>Redis: RPUSH → NodeJob for node-B
    OR-->>C: event: NodeCompleted (node-A)<br/>event: NodeStarted (node-B)

    Redis-->>WK: NodeJob (node-B)
    WK-->>Redis: NodeResult (node-B, completed, tenant_id)

    Note over OR: Dispatcher.advance loads state from DB for each result
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

## Hierarchical Team (agent_team node)

The `agent_team` node is dispatched to the **Agent Worker** as a single job. The worker handles supervisor/member coordination internally. From the orchestrator's perspective it behaves identically to an `agent` node — one `NodeJob` in, one `NodeResult` out.

### Supervisor-handoff loop

The worker injects a synthetic `delegate_to_agent` tool into the supervisor's tool list. The tool's schema contains an `agent_name` enum listing every member agent by name. When the supervisor calls `delegate_to_agent`, the worker runs the named member's full ReAct loop (with its own tools) and returns the output as the tool result. The supervisor can delegate multiple times before producing a final reply.

**Final output resolution:**
- If `exitAgentId` is set and the last agent that ran was the exit agent → that agent's output is returned.
- Otherwise → the supervisor's final text reply is returned.

```mermaid
sequenceDiagram
    autonumber
    participant OR as Orchestrator (Engine)
    participant Redis as Redis
    participant WK as Agent Worker
    participant AIH as AIHub

    OR->>Redis: RPUSH → NodeJob{node_type:"agent_team", node_config:{agentId, memberAgentIds, exitAgentId, ...}}
    OR-->>C: event: NodeStarted {node_id: "team-1"}

    Redis-->>WK: NodeJob
    Note over WK: load supervisor + member agents from DB

    WK-->>C: event: AgentStarted {agent_id: supervisor-id, role: "supervisor"}

    loop Supervisor ReAct iterations
        WK->>AIH: ChatStream(supervisor, tools=[...own_tools, delegate_to_agent])
        AIH-->>WK: assistant message

        alt supervisor calls delegate_to_agent(agent_name, input)
            WK-->>C: event: ToolCallStarted {tool: "delegate_to_agent"}
            WK-->>C: event: AgentStarted {agent_id: member-id, role: "member"}

            loop Member ReAct iterations
                WK->>AIH: ChatStream(member, tools=[...member_tools])
                AIH-->>WK: member assistant message / tool calls
            end

            Note over WK: member output → tool result for supervisor
            WK-->>C: event: AgentCompleted (member)
            WK-->>C: event: ToolCallCompleted {tool: "delegate_to_agent"}

        else supervisor produces final reply (no tool calls)
            WK-->>C: event: AgentCompleted (supervisor)
            Note over WK: resolve output (exitAgentId or supervisor reply)
            WK-->>Redis: NodeResult{tenant_id, status:"completed", output_json}
        end
    end

    OR-->>C: event: NodeCompleted {node_id: "team-1"}
    Note over OR: advanceFrom(team-1) → next node
```

### Config fields

The `agentId` field in `node_config.data` must be the **supervisor** agent UUID. The canvas form writes both `agentId` and `entryAgentId` to the same value when the supervisor is selected.

| Field | Required | Notes |
|---|:---:|---|
| `agentId` | ✓ | Supervisor agent UUID |
| `memberAgentIds` | ✓ | Pool of agents the supervisor can delegate to |
| `exitAgentId` | — | If set and that agent ran last, its output is returned instead of the supervisor's reply |
| `maxIterations` | — | Max supervisor iterations (defaults to agent's own `max_iterations`, then global default of 10) |

---

## Self-Correct Loop (if_else back-edge)

The `if_else` node is dispatched **inline** by the orchestrator. It evaluates `data.ifExpression` against the previous node's `output_json` and routes to the `"true"` or `"false"` outgoing edge. A back-edge on the `"false"` branch re-dispatches the generator node.

The `NodeIterations` counter (max 25) prevents runaway loops.

```mermaid
sequenceDiagram
    autonumber
    participant OR as Orchestrator (Engine)
    participant Redis as Redis
    participant WK as Agent Worker

    OR->>Redis: RPUSH → NodeJob(generate-agent, iteration=1)
    Redis-->>WK: NodeJob
    WK-->>Redis: NodeResult({score:"fail"})

    Note over OR: advanceFrom(generate-agent) → if_else node (inline)
    OR->>OR: evalExpression("{{.score}} == pass", output) → false
    Note over OR: route to "false" edge → back to generate-agent

    OR->>Redis: RPUSH → NodeJob(generate-agent, iteration=2)
    Note over OR: NodeIterations["generate-agent"] = 2
    Redis-->>WK: NodeJob
    WK-->>Redis: NodeResult({score:"pass"})

    Note over OR: evalExpression → true → route to "true" edge → end node
    OR->>OR: advanceFrom(if_else) → end node

    Note over OR: Guard: NodeIterations[node] > 25 → failRun("node exceeded max iterations")
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

---

## Stateless Dispatcher Design

The orchestrator has **no in-memory per-run state**. There is no goroutine kept alive for the lifetime of a run.

```
POST /runs
  → CreateRun: INSERT run → Engine.DispatchEntry() → RPUSH entry NodeJob
  → return 201 (no goroutine spawned)

[N Dispatcher goroutines — any orchestrator instance]:
  BLPOP result queue
  → load run + graph + state from DB (GetByIDOnly)
  → assert result.TenantID == run.TenantID          ← reject mismatched results
  → NewEngine(run, graph, state, repos...)
  → eng.Advance(ctx, result)       ← pure: mutates state, writes to DB, dispatches next jobs
  → discard engine (GC)
```

**Consequences:**
- Orchestrator restarts are transparent — active runs resume automatically when the next `NodeResult` arrives on the queue.
- Multiple orchestrator replicas can process different run results simultaneously with no coordination.
- `RunState` in `runs.state_json` (Postgres JSONB) is the single source of truth; it is updated on every state mutation.
- `ResumeHumanReview` pushes a synthetic `NodeResult` directly onto the result queue instead of routing to an in-memory engine.

### Tenant Isolation in the Queue Path

Every `NodeResult` carries `tenant_id`. The field is stamped by the agent worker from the `NodeJob` it consumed (which in turn was stamped by the orchestrator from the originating run). The dispatcher validates this field before performing any state mutation:

```
result.TenantID ≠ run.TenantID  →  advance() returns error, result is dropped
```

A `NodeResult` pushed by a compromised worker or forged directly into Redis cannot advance a run belonging to a different tenant, because the mismatch is caught before the engine is created.

All run `UPDATE` statements (`UpdateStatus`, `UpdateState`, `UpdateOutput`, `UpdateError`, `SetStarted`) include `AND tenant_id = $N` in their `WHERE` clause, providing a second layer of isolation at the database level.
