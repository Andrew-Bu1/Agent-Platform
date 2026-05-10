# Agent Layer — Human Review Flow

A `human_review` node pauses a run and waits for an external actor (e.g., a human reviewer via the UI) to provide a decision before the graph continues.

---

## Full Sequence

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (SSE open)
    participant OR as Orchestrator (Engine)
    participant PG as PostgreSQL
    participant Redis as Redis
    participant WK as Agent Worker
    participant UI as Review UI

    Note over C,OR: Run is in progress — SSE stream is open

    OR->>Redis: RPUSH → NodeJob{node_type:"human_review", ...}
    OR-->>C: event: NodeStarted<br/>data: {"node_id":"review-node"}

    Redis-->>WK: NodeJob

    WK->>PG: INSERT human_review_tasks {id, run_id, node_run_id, status="waiting", payload}
    WK->>Redis: RPUSH agent:queue:event → NodeResult{events:[HumanReviewRequested{task_id}], status="completed"}

    OR->>OR: handleResult — detects HumanReviewRequested in events
    OR->>PG: UPDATE runs SET state_json={HumanWait:{node_id, node_run_id, task_id}}, updated_at=NOW()
    OR->>PG: UPDATE runs SET status="waiting_for_human", finished_at=NULL
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"HumanReviewRequested"}
    OR-->>C: event: HumanReviewRequested<br/>data: {"task_id":"...", "run_id":"...", "node_run_id":"..."}

    Note over OR: Node stays in PendingNodes — engine loop keeps waiting
    Note over C: Client reads task_id from event

    UI->>PG: SELECT human_review_tasks WHERE id=$task_id (fetch payload for display)
    PG-->>UI: task row (payload shown to reviewer)

    Note over UI: Human reviewer makes decision

    UI->>OR: POST /runs/{run_id}/resume<br/>{"task_id":"...", "output":{"decision":"approved","notes":"..."}}
    OR->>PG: SELECT runs WHERE id=$run_id (verify status=waiting_for_human)
    OR->>OR: Parse state_json → validate HumanWait.TaskID matches
    OR->>PG: UPDATE runs SET state_json={HumanWait:null}
    OR->>PG: UPDATE runs SET status="running"
    OR->>OR: Dispatcher.Resume(runID, NodeResult{node_id, node_run_id, status="completed", output})

    OR->>OR: Engine receives injected NodeResult
    Note over OR: handleResult — no HumanReviewRequested event this time → normal flow
    OR->>PG: UPDATE node_runs SET status="completed", output_json=$decision
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"NodeCompleted"}
    OR-->>C: event: NodeCompleted<br/>data: {"node_id":"review-node"}

    Note over OR,C: Graph advances normally from the review node's outgoing edge
```

---

## State During Pause

While the run is `waiting_for_human`, the `runs.state_json` contains:

```json
{
  "completed_nodes": {"start": true, "node-A": true},
  "pending_nodes": {"review-node": true},
  "node_iterations": {"start": 1, "node-A": 1, "review-node": 1},
  "human_wait": {
    "node_id": "review-node",
    "node_run_id": "uuid",
    "task_id": "uuid"
  }
}
```

The `HumanWait` field is cleared when `POST /runs/{id}/resume` is called.

---

## Resume Validation

The orchestrator validates three things before injecting the result:

1. Run status must be `waiting_for_human`
2. `state_json.human_wait` must be non-null
3. `task_id` in the request body must match `state_json.human_wait.task_id`

If any check fails, a `400/500` JSON error is returned (not SSE).

---

## What Happens if the Engine Restarts?

The engine goroutine is in-memory only. If the orchestrator process restarts while a run is `waiting_for_human`:

- The `runs` row still has `status=waiting_for_human` and the `HumanWait` state in `state_json`
- `POST /runs/{id}/resume` will succeed at the DB level but `Dispatcher.Resume` will return `false` (engine not found)
- The API returns a 500 with message "engine not active for run — it may have been restarted"
- **Recovery**: a restart recovery mechanism is needed (re-hydrate engine from DB state). This is tracked as a known limitation.

---

## API Reference

### POST /runs/{id}/resume

Resumes a run waiting at a human_review node.

**Request:**
```json
{
  "task_id": "uuid",
  "output": {
    "decision": "approved",
    "notes": "Looks good"
  }
}
```

**Response (200):**
```json
{"status": "resumed"}
```

**Error cases:**
- `400` — `task_id` missing or zero
- `500` — run not in `waiting_for_human` status, task_id mismatch, or engine not active
