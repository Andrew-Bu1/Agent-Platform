# Agent Layer — `graph_json` Schema

**Last updated:** 2026-05-19

`graph_json` is the serialised flow graph stored in `flow_versions.graph_json`.  
It is written by the **Agent Studio Web** canvas (React/TypeScript) and parsed by the **Agent Orchestrator** engine (Go) at run-time.

---

## Top-Level Shape

```json
{
  "entry_node_id": "start-1",
  "nodes": {
    "start-1":   { "type": "start",   "label": "Start",      "data": {},                              "position": { "x": 100, "y": 200 } },
    "agent-1":   { "type": "agent",   "label": "Researcher", "data": { "agentId": "uuid-..." },       "position": { "x": 350, "y": 200 } },
    "end-1":     { "type": "end",     "label": "End",        "data": {},                              "position": { "x": 600, "y": 200 } }
  },
  "edges": [
    { "id": "e-0", "source": "start-1", "target": "agent-1" },
    { "id": "e-1", "source": "agent-1", "target": "end-1" }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `entry_node_id` | `string` | ✅ | ID of the first node the engine dispatches |
| `nodes` | `Record<string, GraphNode>` | ✅ | **Object keyed by node ID** (not an array) |
| `edges` | `GraphEdge[]` | ✅ | Directed connections between nodes |

> **Why an object, not an array?** The canvas uses node IDs as stable references. Storing them as a keyed object removes the need for an extra `id` field inside each node and makes lookup O(1) on the frontend. The orchestrator calls `graph.PopulateNodeIDs()` after unmarshal to copy each map key into `GraphNode.ID`.

---

## Node Object

```typescript
interface GraphNode {
  type:     NodeKind;           // required — controls engine routing
  label:    string;             // human-readable name (stored as node_runs.node_name)
  data:     CanvasNodeData;     // type-specific config parsed by worker/engine
  position: { x: number; y: number }; // canvas-only, ignored at runtime
}
```

The `data` field is passed verbatim to the worker as `NodeJob.NodeConfig`. Each node type specifies what it expects inside `data`.

---

## Node Types

### `start` — Entry point

Always the first node. Dispatched inline by the orchestrator; passes `run.input_json` through unchanged.

```json
{ "type": "start", "label": "Start", "data": {} }
```

No `data` fields required.

---

### `end` — Terminal node

Dispatched inline. Its input becomes `run.output_json`.

```json
{ "type": "end", "label": "End", "data": {} }
```

No `data` fields required.

---

### `agent` — Single LLM agent (ReAct loop)

Dispatched to the **Agent Worker**.

```json
{
  "type": "agent",
  "label": "Researcher",
  "data": {
    "agentId":        "uuid-of-agent",
    "modelId":        "gpt-4o",
    "maxIterations":  10,
    "memory": {
      "memory_strategy":            "last_n",
      "memory_last_n":              30,
      "memory_summarize_threshold": 40,
      "memory_summarize_model":     "gpt-4o-mini"
    }
  }
}
```

| `data` field | Type | Description |
|---|---|---|
| `agentId` | `string` (UUID) | **Required.** Agent record to load from DB |
| `modelId` | `string` | Optional override for the agent's default model |
| `maxIterations` | `number` | Override the agent's default max ReAct iterations (hard ceiling: 100) |
| `memory.memory_strategy` | `string` | `"last_n"` (default), `"none"`, or `"summarize"`. Overrides the agent-level default. |
| `memory.memory_last_n` | `number` | Window size for `last_n`; defaults to `20` when unset or `0` |
| `memory.memory_summarize_threshold` | `number` | For `summarize`: trigger summarization when unsummarized tail exceeds N; defaults to `40` |
| `memory.memory_summarize_model` | `string` | For `summarize`: model used for the summarizer call; defaults to the agent's own model |

The worker parses `data` into `NodeAgentConfig` (json tags: `agentId`, `maxIterations`, `timeoutSeconds`, `memory`).

> **Iteration ceiling:** regardless of what `maxIterations` is set to in the node config or agent definition, the worker enforces a hard cap of **100 iterations** per agent execution. Values above 100 are silently clamped. This applies to plain `agent` nodes, `agent_team` supervisors, and member agents.

---

### `agent_team` — Supervisor handoff team

Dispatched to the **Agent Worker**. The supervisor agent uses LLM reasoning to dynamically decide which member agent to delegate to next at runtime. This is the only coordination strategy — deterministic routing belongs on the outer canvas (use `router`, `if_else`, or direct edges instead).

```json
{
  "type": "agent_team",
  "label": "Research Team",
  "data": {
    "agentId":        "uuid-of-supervisor",
    "entryAgentId":   "uuid-of-supervisor",
    "exitAgentId":    "uuid-of-final-agent",
    "memberAgentIds": ["uuid-A", "uuid-B"],
    "maxIterations":  3,
    "memory": {
      "memory_strategy": "last_n",
      "memory_last_n":   20
    }
  }
}
```

| `data` field | Type | Description |
|---|---|---|
| `agentId` | `string` (UUID) | **Required.** Supervisor agent (same value as `entryAgentId`) |
| `entryAgentId` | `string` (UUID) | Entry/supervisor agent — must equal `agentId` |
| `exitAgentId` | `string` (UUID) | Agent whose output is returned to the parent flow (optional; defaults to supervisor's last reply) |
| `memberAgentIds` | `string[]` | Pool of agents the supervisor can hand off to |
| `maxIterations` | `number` | Max handoff iterations before the team is terminated (hard ceiling: 100) |
| `memory.memory_strategy` | `string` | Memory strategy applied to the **supervisor**. Member agents use their own agent-level config. |
| `memory.memory_last_n` | `number` | Window size for the supervisor's `last_n` strategy |
| `memory.memory_summarize_threshold` | `number` | For `summarize`: trigger threshold for the supervisor; defaults to `40` |
| `memory.memory_summarize_model` | `string` | For `summarize`: summarizer model for the supervisor; defaults to supervisor's model |

> **Why no `teamType`?** Earlier designs included `graph`, `handoff`, and `hybrid` modes. `graph` and `hybrid` were redundant with the outer flow canvas — any deterministic routing pattern (sequential, parallel, loops) can be expressed there. `agent_team` now exclusively means supervisor-driven LLM handoff.

**Runtime: `delegate_to_agent` synthetic tool**

The Agent Worker automatically injects a `delegate_to_agent` tool into the supervisor's tool list at runtime — it does not appear in the flow graph JSON. Its schema contains an `agent_name` enum listing each member agent by name and an `input` string. When the supervisor calls this tool, the worker runs the named member's full ReAct loop and returns the member's output as the tool result. The supervisor may delegate multiple times before producing its final reply.

Output returned to the parent flow:
- `exitAgentId` set and was the last agent to run → that agent's output.
- Otherwise → the supervisor's final text reply.

---

### `if_else` — Conditional branch

Dispatched **inline** by the orchestrator. Evaluates an expression against the previous node's output and routes to the `true` or `false` outgoing edge.

```json
{
  "type": "if_else",
  "label": "Quality Gate",
  "data": {
    "ifExpression": "{{.score}} == pass"
  }
}
```

| `data` field | Type | Description |
|---|---|---|
| `ifExpression` | `string` | Expression evaluated against previous output JSON |

**Expression syntax** — supports `==` and `!=`:

```
{{.fieldName}} == someValue
{{.status}} != rejected
```

The template references a top-level key in the previous node's `output_json`. If the expression is empty or the field is missing, the result is `false`.

**Edges:** the two outgoing edges must have `label: "true"` and `label: "false"`.

---

### `router` — Dynamic routing by output field

Dispatched **inline** by the orchestrator. Routes to the edge whose `label` matches `output.route`.

```json
{
  "type": "router",
  "label": "Topic Router",
  "data": {
    "routes": [
      { "label": "legal",   "handle": "legal" },
      { "label": "finance", "handle": "finance" }
    ]
  }
}
```

| `data` field | Type | Description |
|---|---|---|
| `routes` | `{ label, handle }[]` | Palette display only — the engine routes by matching `output.route` string to edge labels |

The previous node must return `{ "route": "legal" }` (or another label key). If no edge label matches, the engine tries `"default"`.

---

### `parallel` — Fan-out dispatcher

Dispatched **inline** by the orchestrator. Immediately fires all outgoing edges simultaneously. Does not wait; the `aggregator` node is the synchronisation point.

```json
{
  "type": "parallel",
  "label": "Fan Out",
  "data": { "branchCount": 2 }
}
```

| `data` field | Type | Description |
|---|---|---|
| `branchCount` | `number` | Display hint for the number of branch handles on the canvas |

---

### `aggregator` — Fan-in collector

Dispatched to the **Agent Worker** when all incoming parallel branches complete. Its input is a merged JSON object keyed by source node ID.

```json
{
  "type": "aggregator",
  "label": "Merge Results",
  "data": { "agentId": "uuid-of-aggregator-agent", "strategy": "concat" }
}
```

| `data` field | Type | Description |
|---|---|---|
| `agentId` | `string` (UUID) | Agent that synthesises the merged inputs |
| `strategy` | `string` | Display only (e.g. `"concat"`, `"vote"`) |

The merged input fed to the agent:

```json
{
  "branch-agent-A": { ...outputFromA... },
  "branch-agent-B": { ...outputFromB... }
}
```

---

### `human_review` — Human-in-the-loop pause

Dispatched to the **Agent Worker**. The worker inserts a `human_review_tasks` row, publishes `HumanReviewRequested` to the run's SSE stream, and returns `NodeResult` with the event attached. The orchestrator sets `run.status = waiting_for_human` and pauses graph advancement until `POST /runs/{id}/resume` is called.

```json
{
  "type": "human_review",
  "label": "Legal Review",
  "data": {}
}
```

No `data` fields required. The run's current input is recorded as the task `payload` and shown to the reviewer.

Resume body:

```json
{ "task_id": "uuid", "output": { "decision": "approved", "notes": "..." } }
```

The `output` becomes the node's `output_json` and the input to the next node.

---

## Memory Configuration

Conversation history loading is controlled by a `MemoryConfig` that can be set at two levels, resolved in priority order:

```
node data.memory  →  agent entity config.memory  →  default {strategy:"last_n", last_n:20}
```

### Strategies

| `memory_strategy` | Behaviour |
|---|---|
| `"last_n"` | Load the **most recent `memory_last_n` messages** for the thread in chronological order. Default strategy. |
| `"none"` | Skip thread history entirely — the agent receives only the system prompt and the current run input. Use for stateless/pure-function agents. |
| `"summarize"` | Keep a **rolling summary** stored as a `role=summary` message directly in the `messages` table. On each run: load the latest summary + any messages added since; if the unsummarized tail exceeds `memory_summarize_threshold`, call the summarizer LLM, insert a new summary message, and clear the tail. The agent receives `[system prompt] + [system: summary text] + [tail messages] + [user input]`. |

### Agent-level default (Agent page)

Set in **Agent Studio → Agents → Edit agent → Memory section**. Stored inside `agents.definition` JSON:

```json
{
  "max_iterations": 10,
  "memory": {
    "memory_strategy": "last_n",
    "memory_last_n":   50
  }
}
```

This is the default used whenever no node-level override is present.

### Node-level override (Canvas)

Set in **Agent Studio → Flow canvas → click an `agent` or `agent_team` node → Configure tab → Memory section**. Stored inside `graph_json.nodes[id].data`:

```json
{
  "agentId": "uuid-...",
  "memory": {
    "memory_strategy": "last_n",
    "memory_last_n":   30
  }
}
```

For `agent_team` nodes this override applies to the **supervisor only**.

### Resolution example

| Level | `memory_strategy` | Result |
|---|---|---|
| Node override | `"none"` | History skipped regardless of agent default |
| Node override | `"last_n"` | Most recent `memory_last_n` messages (default window: 20) |
| Node override | `"summarize"` | Rolling summary; tail threshold from `memory_summarize_threshold` (default: 40) |
| Node override absent, agent default set | — | Agent default used |
| Both absent | — | `last_n` with window `20` |

### `agent_team` member agents

The `memory` field on an `agent_team` node applies only to the **supervisor**. Each member agent uses its own `agents.definition.memory` default with no node-level override path — the team node config does not propagate memory settings into member executions.

---

## Edge Object

```typescript
interface GraphEdge {
  id:            string;   // unique within the graph
  source:        string;   // source node ID
  target:        string;   // target node ID
  sourceHandle?: string;   // branch handle ID (for parallel / router / if_else)
  targetHandle?: string;   // canvas-only, ignored at runtime
  label?:        string;   // branch key for if_else ("true"/"false") and router
}
```

### Edge Labels by Node Type

| Source type | `label` value | Meaning |
|---|---|---|
| `if_else` | `"true"` | Expression evaluated to true |
| `if_else` | `"false"` | Expression evaluated to false |
| `router` | any string | Must match `output.route` from previous node |
| `router` | `"default"` | Fallback when no label matches |
| `parallel` | any | Ignored; all outgoing edges are always fired |
| others | — | Not used; only the first outgoing edge is followed |

---

## Back-Edges (Self-Correct Loop)

A back-edge targets a node that has already been dispatched. The engine permits this up to **25 iterations per node** (`maxNodeIterations` constant). On the 26th dispatch attempt, `failRun` is called.

Pattern 4 (self-correct loop):

```
start → generate-agent → if_else → (true) → end
                          ↑ (false)
                          └── generate-agent   ← back-edge
```

The `if_else` node's `"false"` edge points back to `generate-agent`. This causes `NodeIterations["generate-agent"]` to increment each pass.

---

## Runtime Parsing

The orchestrator loads `graph_json` in `RunService.CreateAndStream`:

```go
var graph model.Graph
if err := json.Unmarshal(fv.GraphJSON, &graph); err != nil {
    return nil, nil, fmt.Errorf("parse graph_json: %w", err)
}
graph.PopulateNodeIDs()   // copies map keys → GraphNode.ID
```

`PopulateNodeIDs` must be called before passing the graph to the engine. Without it, `GraphNode.ID` is empty and node lookups silently fail.

---

## Publish Validation (server-side)

Before a flow version can be published, `FlowService.publish()` validates:

1. `graph_json` is parseable JSON
2. `entry_node_id` is non-null and non-blank
3. `nodes` is a non-empty object (at least one node exists)

These checks happen at the BFF layer. The orchestrator performs no further structural validation at run-start — a malformed graph causes `failRun` at the point of the first broken node lookup.

---

## Agentic Patterns

| Pattern | Node types used | Notes |
|---|---|---|
| **Sequential** | `start → agent → [agent…] → end` | Default single-edge flow |
| **Parallel fan-out** | `parallel → [agent…] → aggregator` | All branches fire simultaneously; aggregator waits for all |
| **Supervisor handoff** | `agent_team` | Supervisor LLM decides at runtime which member agent to call next |
| **Self-correct loop** | `agent → if_else → (back-edge)` | Loop until condition passes; guarded at 25 iterations |
| **Deterministic routing** | `router` | Previous node sets `output.route`; engine follows matching edge label |

Human-in-the-loop is a first-class complement to any pattern: insert a `human_review` node anywhere in the graph.

### Choosing between `agent_team` and canvas routing

| Use `agent_team` when… | Use canvas nodes when… |
|---|---|
| The routing decision requires LLM reasoning | The routing is deterministic (field value, condition, fixed order) |
| You want the supervisor to delegate dynamically based on task content | You know the execution path at design time |
| Members are interchangeable and the supervisor picks the best fit | Each branch has a fixed role and fixed wiring |
