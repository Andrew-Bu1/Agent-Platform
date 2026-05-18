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
    WK->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"HumanReviewRequested"} (real-time)
    OR-->>C: event: HumanReviewRequested<br/>data: {"task_id":"...", "run_id":"...", "node_run_id":"..."}
    WK->>Redis: RPUSH agent:queue:event → NodeResult{events:[HumanReviewRequested], status="completed"}

    OR->>OR: handleResult — persists HumanReviewRequested to run_events DB (for replay)
    OR->>OR: detects HumanReviewRequested in events — sets human_wait state
    OR->>PG: UPDATE runs SET state_json={HumanWait:{node_id, node_run_id, task_id}}, updated_at=NOW()
    OR->>PG: UPDATE runs SET status="waiting_for_human", finished_at=NULL

    Note over OR: Advance() returns — no goroutine is kept alive
    Note over C: Client reads task_id from event

    UI->>PG: SELECT human_review_tasks WHERE id=$task_id (fetch payload for display)
    PG-->>UI: task row (payload shown to reviewer)

    Note over UI: Human reviewer makes decision

    UI->>OR: POST /runs/{run_id}/resume<br/>{"task_id":"...", "output":{"decision":"approved","notes":"..."}}
    OR->>PG: SELECT runs WHERE id=$run_id (verify status=waiting_for_human)
    OR->>OR: Parse state_json → validate HumanWait.TaskID matches
    OR->>PG: UPDATE runs SET state_json={HumanWait:null}
    OR->>PG: UPDATE runs SET status="running"
    OR->>Redis: RPUSH agent:queue:event → NodeResult{node_id, node_run_id, status="completed", output}

    Note over OR: Dispatcher picks up NodeResult from queue (any instance)
    OR->>OR: Advance() — loads run+graph+state from DB, no HumanReviewRequested event → normal flow
    OR->>PG: UPDATE node_runs SET status="completed", output_json=$decision
    OR->>Redis: PUBLISH run:{run_id}:stream → SSEEvent{type:"NodeCompleted"}
    OR-->>C: event: NodeCompleted<br/>data: {"node_id":"review-node"}

    Note over OR,C: Graph advances normally from the review node's outgoing edge
```

---

## Event Publishing

The agent worker publishes `HumanReviewRequested` **directly to Redis Pub/Sub in real-time** — before returning `NodeResult`. The client receives the event immediately when the human review task is created, without waiting for the orchestrator's `handleResult` loop.

The orchestrator's `handleResult` then:
1. Persists the event to `run_events` (for the reconnect/replay path)
2. Detects `HumanReviewRequested` and updates the run state/status to `waiting_for_human`

This means the event reaches the client ~1 DB round-trip sooner than the old approach where the orchestrator published after receiving `NodeResult`.

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

## What Happens if the Orchestrator Restarts?

Because the orchestrator is fully stateless (no in-memory engine goroutines), a restart has **no impact** on runs that are `waiting_for_human`:

- The `runs` row retains `status=waiting_for_human` and the full `HumanWait` state in `state_json`.
- When `POST /runs/{id}/resume` is called after a restart, it reads from DB, validates, clears `HumanWait`, and pushes the `NodeResult` onto the Redis queue.
- The Dispatcher (on whichever instance is running) picks it up and processes it normally.

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
