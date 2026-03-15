# Load Tests

Performance and load tests using [Locust](https://locust.io/).

## Directory structure

```
tests/load/
└── aihub/                   # AIHub service
    ├── locustfile.py        # Entry point — three user classes
    ├── config.py            # Env-var-based configuration
    ├── tasks/
    │   ├── embedding.py     # EmbeddingTasks (POST /v1/embed)
    │   └── rerank.py        # RerankTasks   (POST /v1/rerank)
    └── fixtures/
        └── texts.py         # Sample texts / document sets
```

> More services will follow the same pattern: `tests/load/<service>/`.

---

## Prerequisites

Install Locust (once, into the UV workspace or a venv):

```bash
uv add --dev locust
# or
pip install locust
```

---

## Running the AIHub tests

### Web UI (recommended for first run)

```bash
cd /path/to/Agent-Platform

locust -f tests/load/aihub/locustfile.py
# Open http://localhost:8089 — set host, users, spawn rate, then Start
```

### Headless (CI / scripted)

```bash
locust -f tests/load/aihub/locustfile.py \
    --headless \
    --host http://localhost:8000 \
    --users 20 \
    --spawn-rate 2 \
    --run-time 60s
```

### Run only embedding or only rerank

Pass `--class-picker` in the web UI, or use `--user-classes` headless:

```bash
# Embedding only
locust -f tests/load/aihub/locustfile.py \
    --headless \
    --host http://localhost:8000 \
    --user-classes AihubEmbedUser \
    --users 10 --spawn-rate 2 --run-time 30s

# Rerank only
locust -f tests/load/aihub/locustfile.py \
    --headless \
    --host http://localhost:8000 \
    --user-classes AihubRerankUser \
    --users 5 --spawn-rate 1 --run-time 30s
```

---

## Configuration via environment variables

| Variable            | Default                      | Description                                |
|---------------------|------------------------------|--------------------------------------------|
| `AIHUB_HOST`        | `http://localhost:8000`      | Base URL of the running aihub service      |
| `AIHUB_EMBED_MODEL` | `BAAI/bge-small-en-v1.5`    | Model name for `/v1/embed`                 |
| `AIHUB_RERANK_MODEL`| `BAAI/bge-reranker-base`    | Model name for `/v1/rerank`                |
| `EMBED_TASK_WEIGHT` | `3`                          | Relative weight of embed tasks (mixed user)|
| `RERANK_TASK_WEIGHT`| `1`                          | Relative weight of rerank tasks            |
| `RERANK_TOP_N`      | _(unset → return all)_       | `top_n` passed to rerank requests          |
| `WAIT_MIN`          | `0.5`                        | Min seconds between user tasks             |
| `WAIT_MAX`          | `2.0`                        | Max seconds between user tasks             |

Example:

```bash
AIHUB_HOST=http://staging.internal:8000 \
AIHUB_EMBED_MODEL=my-custom-embed-model \
locust -f tests/load/aihub/locustfile.py --headless --users 50 --spawn-rate 5 --run-time 120s
```

---

## User classes

| Class              | Behaviour                                      |
|--------------------|------------------------------------------------|
| `AihubEmbedUser`   | Only calls `POST /v1/embed`                    |
| `AihubRerankUser`  | Only calls `POST /v1/rerank`                   |
| `AihubMixedUser`   | Calls both, weighted by task weights           |

When no `--user-classes` flag is given, Locust spawns all three proportionally.

---

## Interpreting results

Key metrics to watch:

- **RPS (Requests/sec)** — throughput per endpoint
- **p50 / p95 / p99 response time** — latency distribution; ML inference typically shows high p99
- **Failure %** — should stay 0 %; non-200 responses are marked as failures
- **Response time trends** — a rising p95 under constant load indicates saturation
