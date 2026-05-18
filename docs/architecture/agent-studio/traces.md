# Agent Studio — Traces UI

The Traces page (`/traces`) provides a step-by-step view of every run executed in the workspace, showing each node's execution result, duration, and input/output data.

---

## Layout

The page is split into two panels:

```
┌──────────────────┬──────────────────────────────────────────┐
│  Runs list       │  Trace detail                            │
│  (left, 288px)   │  (right, fills remaining width)          │
│                  │                                          │
│  ● Completed     │  Run header                              │
│    <run-id>      │    Status · Thread · Duration            │
│    2026-05-17    │                                          │
│                  │  ── Timeline ─────────────────────────── │
│  ● Running       │  ● start          completed    0ms       │
│    <run-id>      │  ● Research Agent completed    1.4s  ↓   │
│    ...           │      Input:  { "message": "..." }        │
│                  │      Output: { "result": "..." }         │
│  [ Prev / Next ] │  ● end            completed    0ms       │
└──────────────────┴──────────────────────────────────────────┘
```

Both panels scroll independently. The overall container is fixed-height (`100vh − header`), so the page itself does not scroll.

---

## Data Sources

| Data | API endpoint (BFF) | Backed by |
|---|---|---|
| Run list | `GET /api/v1/orchestrator/runs?page=0&size=30` | `runs` table (orchestrator) |
| Node steps | `GET /api/v1/orchestrator/runs/{id}/node-runs` | `node_runs` table (orchestrator) |

### Run list

Fetches up to 30 runs per page, newest first. Clicking any run in the left panel loads that run's node steps into the right panel. The first run in the list is auto-selected on page load.

### Node steps (`node_runs`)

Each row in `node_runs` represents one invocation of a graph node. Steps are ordered `created_at ASC`, matching the actual execution sequence.

Fields displayed per step:

| Field | Shown as |
|---|---|
| `node_name` / `node_id` | Step title |
| `node_type` | Icon + mono label (`agent`, `if_else`, etc.) |
| `branch_key` | Badge if non-empty (`branch: true`) |
| `iteration` | Badge if > 0 (`iter 1`) |
| `status` | Coloured text (`completed`, `failed`, `running`) |
| `started_at` → `finished_at` | Duration (`1.4s`, `320ms`, `—` if not yet finished) |
| `input_json` | Expandable code block |
| `output_json` | Expandable code block |
| `error_json` | Expandable code block (shown only on failure) |

---

## Node Type Icons

| `node_type` | Icon | Colour |
|---|---|---|
| `start` | Play | Blue |
| `end` | Flag | Gray |
| `agent` | Bot | Violet |
| `agent_team` | Users | Indigo |
| `if_else` | GitBranch | Amber |
| `router` | Share2 | Orange |
| `parallel` | Layers | Cyan |
| `aggregator` | Activity | Teal |
| `human_review` | MessageSquare | Amber |

---

## Timeline Status Dots

The vertical line connecting steps uses coloured dots to indicate step status at a glance:

| `status` | Dot colour |
|---|---|
| `completed` | Emerald |
| `failed` | Red |
| `running` | Blue (pulsing) |
| `pending` | Gray |
| `skipped` | Light gray |

---

## Interaction

- **Click a run** in the left panel → loads that run's node steps. The detail panel key-resets, discarding any previously expanded steps.
- **Click a step card** → toggles the input/output JSON expansion.
- **Refresh button** (top-right of detail panel) → re-fetches `node-runs` for the selected run without re-fetching the run list. Useful for runs still in `running` state.
- **Page Prev/Next** (bottom of run list) → fetches the next or previous page of 30 runs.

---

## Access Control

The Traces page is accessible to any authenticated workspace member — it reads runs and node-runs scoped to the caller's `tenant_id` + `workspace_id` from their JWT. No additional permission beyond a valid workspace-scoped token is required.

---

## Related Pages

| Page | Path | Relation |
|---|---|---|
| Runs | `/runs` | Same run data; adds live SSE streaming and human-review actions |
| Analytics | `/analytics` | Aggregated token/cost view across all runs |
