# AIHub Service — Features & API Reference

Base URL (internal): `http://aihub:8000`  
Base URL (via BFF proxy): `http://agent-studio:8082/api/v1/aihub/...`  
Auth: Bearer JWT (RS256) forwarded by the BFF on all endpoints.

---

## 1. Providers

Providers represent AI backends (OpenAI, Anthropic, local, etc.). Managed via the admin API.

### Endpoints
```
GET    /v1/providers                  — list all active providers
GET    /v1/providers/{id}             — get provider by ID
POST   /v1/providers                  — create provider
PATCH  /v1/providers/{id}             — update provider (config, display_name, base_url, etc.)
DELETE /v1/providers/{id}             — deactivate provider
```

### Built-in `local` provider
A `local` provider row (`provider_key = 'local'`) is seeded by migration `003_seed_local_provider.sql`.
It registers `LocalEmbedAdapter` and `LocalRerankAdapter` in the adapter registry at startup,
enabling self-hosted embedding and rerank without an external API key.

### `config_json` field
Stored as `JSONB` in Postgres. `asyncpg` returns JSONB columns as raw JSON strings — the repository
layer parses them with `json.loads()` before constructing `ProviderRecord` objects.  
When writing, `json.dumps()` is used to serialise the dict back to a JSON string for the `$N` parameter.

---

## 2. Model Configs

Model configurations map a `model_key` (e.g. `gpt-4o`, `bge-m3`) to a provider and specify
adapter-level settings (context window, capabilities, etc.).

### Endpoints
```
GET    /v1/models                     — list all active model configs
GET    /v1/models/{id}                — get model config by ID
POST   /v1/models                     — create model config
PATCH  /v1/models/{id}                — update model config
DELETE /v1/models/{id}                — deactivate model config
```

---

## 3. Inference APIs

### Chat
```
POST /v1/chat    — chat completion (streaming SSE)
```
Routes to the configured chat adapter for the requested `model_key`.  
Enforces tenant model entitlements (RPM / TPM limits) via IAM.

### Embed
```
POST /v1/embed   — text embedding
```
Body: `{ "model": "<model_key>", "input": ["text1", "text2"] }`  
Returns: `{ "embeddings": [[...], [...]] }`

### Rerank
```
POST /v1/rerank  — cross-encoder reranking
```
Body: `{ "model": "<model_key>", "query": "...", "documents": ["doc1", "doc2"] }`  
Returns: `{ "results": [{ "index": 0, "score": 0.92 }, ...] }`

---

## 4. Adapter Registry

Built at startup by `build_registry()` in `adapters/registry.py`.  
Reads all active provider rows from the DB and instantiates the matching adapter class
based on `adapter_type`:

| `adapter_type` | Adapter class | Notes |
|---|---|---|
| `openai` | `OpenAIAdapter` | Requires `api_key` in `config_json` |
| `anthropic` | `AnthropicAdapter` | Requires `api_key` in `config_json` |
| `local` | `LocalEmbedAdapter` / `LocalRerankAdapter` | No API key; loads model from `.models/` volume |

If no `local` provider row exists in the DB, local adapters are never registered.
