# AIHub — Feature Reference

AIHub is the AI model gateway for the Agent Platform. It exposes a unified REST API for chat, embedding, and reranking across any number of AI providers, enforcing per-tenant entitlements and rate limits on every call.

---

## 1. Authentication

Every request to AIHub requires a JWT Bearer token issued by the IAM service.

**How it works:**

1. The client sends `Authorization: Bearer <jwt>` on every request.
2. AIHub extracts the `kid` (key ID) from the token header.
3. The `JwksCache` looks up the corresponding RSA public key. If the `kid` is unknown it re-fetches the JWKS endpoint from IAM — this handles key rotation without any polling.
4. The token is verified with `RS256` and its claims are parsed into a `CallerContext`.
5. `CallerContext` carries: `subject`, `tenant_id`, `workspace_id`, `caller_type` (`user` | `service_client`), `bearer_token` (forwarded to IAM for entitlement checks), and `permissions`.

**Error responses:**

| Condition | Status |
|---|---|
| Missing/malformed token | 401 |
| Unknown signing key after re-fetch | 401 |
| Expired token | 401 |
| Missing `tenant_id` claim | 401 |

---

## 2. Provider Management

Providers are rows in the `providers` table. Adding a new AI provider requires no code change — create a row via the API, set the correct `adapter_type`, and restart the service to rebuild the adapter registry.

### `GET /v1/providers`
Returns all providers ordered by `sort_order`.

### `GET /v1/providers/{id}`
Returns a single provider.

### `POST /v1/providers` — Create provider

```json
{
  "provider_key": "openrouter",
  "display_name": "OpenRouter",
  "description": "Multi-model API gateway",
  "logo_url": "https://openrouter.ai/favicon.ico",
  "base_url": "https://openrouter.ai/api/v1",
  "adapter_type": "openai_compatible",
  "sort_order": 1
}
```

`adapter_type` determines which code adapter is used:
- `openai_compatible` — any provider that follows the OpenAI chat completions format (OpenRouter, OpenAI, Together AI, Groq, Mistral, etc.). The API key is stored encrypted in `config_json` and decrypted at startup using `PROVIDER_ENCRYPTION_KEY`.
- `local` — models loaded in-process via SentenceTransformer (embed) or CrossEncoder (rerank).

### `PATCH /v1/providers/{id}` — Update provider
Allows updating `display_name`, `description`, `logo_url`, `base_url`, `adapter_type`, `is_active`, `sort_order`.

### `DELETE /v1/providers/{id}` — Delete provider
Returns 409 if model configs reference this provider (FK constraint).

**API key storage:**
Provider API keys are stored encrypted in the `config_json` column of the `providers` table using Fernet symmetric encryption. The encryption key is set via `PROVIDER_ENCRYPTION_KEY` in the environment. The plaintext key is never stored or logged — only the encrypted value lives in the DB. GET responses replace `config_json` with a `has_api_key: bool` field.

To rotate a key: `PATCH /v1/providers/{id}` with `{"api_key": "new-key"}`.

**Note:** The adapter registry is built once at startup from active providers. Adding a new provider or rotating a key requires a service restart to pick up the new decrypted key.

---

## 3. Model Config Management

Model configs map an internal `model_key` to a specific provider and model. They control which capabilities are exposed and what the pricing is.

### `GET /v1/models`
Query params: `operation_type` (chat|embed|rerank), `provider_key`.

### `GET /v1/models/{id}`

### `POST /v1/models` — Create model config

```json
{
  "provider_key": "openrouter",
  "model_key": "claude-3-5-sonnet",
  "display_name": "Claude 3.5 Sonnet",
  "description": "Anthropic Claude 3.5 Sonnet via OpenRouter",
  "provider_model_id": "anthropic/claude-3-5-sonnet",
  "operation_type": "chat",
  "supports_streaming": true,
  "supports_tools": true,
  "supports_json_mode": true,
  "supports_vision": true,
  "input_cost": "0.000003",
  "output_cost": "0.000015",
  "context_window_tokens": 200000,
  "max_output_tokens": 8192
}
```

- `model_key` + `operation_type` is unique — the same model key can appear for both `chat` and `embed` if the provider supports both.
- `provider_model_id` is the actual model identifier sent to the provider API (e.g. `anthropic/claude-3-5-sonnet` for OpenRouter, `claude-3-5-sonnet-20241022` for Anthropic direct).
- `endpoint_url` overrides the provider's `base_url` for this specific model.

### `PATCH /v1/models/{id}` — Update model config
Mutable fields: `display_name`, `description`, `endpoint_url`, `input_cost`, `output_cost`, `context_window_tokens`, `max_output_tokens`, `supports_*` flags, `is_active`.

### `DELETE /v1/models/{id}` — Delete model config
Returns 409 if usage logs reference this model (FK constraint).

---

## 4. Chat

### `POST /v1/chat`

```json
{
  "model": "claude-3-5-sonnet",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false,
  "tools": [...],
  "tool_choice": "auto"
}
```

- `model` is the internal `model_key` — AIHub resolves it to a provider and `provider_model_id`.
- `tools` and `tool_choice` are forwarded to the provider as-is (OpenAI tool format).
- `stream: true` returns an SSE stream (`text/event-stream`) in the OpenAI SSE format.
- If the model config has `supports_streaming: false`, streaming requests will be rejected by the provider (not enforced at the AIHub layer).

**Non-streaming response** follows the OpenAI ChatCompletion format.

**Streaming response** — SSE chunks with `data: {...}` lines. The final chunk includes `usage` fields which AIHub uses for token accounting.

---

## 5. Embedding

### `POST /v1/embed`

```json
{
  "model": "bge-m3",
  "input": ["text to embed", "another text"]
}
```

- `input` can be a string or a list of strings.
- Returns a list of float vectors in the same order as the inputs.

For `local` adapter models, the SentenceTransformer is loaded from `.models/{model_key}` on first use. If the directory doesn't exist, it is downloaded from HuggingFace Hub using `provider_model_id` as the Hub model ID.

```json
{
  "model": "bge-m3",
  "data": [
    {"index": 0, "embedding": [0.023, -0.118, ...]},
    {"index": 1, "embedding": [0.045, -0.201, ...]}
  ],
  "usage": {"total_tokens": 12}
}
```

---

## 6. Reranking

### `POST /v1/rerank`

```json
{
  "model": "bge-reranker-v2-m3",
  "query": "what is the capital of France",
  "documents": ["Paris is...", "Berlin is...", "London is..."],
  "top_n": 2
}
```

- Scores each document against the query using a CrossEncoder.
- Returns documents sorted by `relevance_score` descending, trimmed to `top_n` if specified.

```json
{
  "model": "bge-reranker-v2-m3",
  "results": [
    {"index": 0, "document": "Paris is...", "relevance_score": 0.97},
    {"index": 2, "document": "London is...", "relevance_score": 0.12}
  ]
}
```

---

## 7. Entitlement Enforcement

Every inference request (chat, embed, rerank) goes through `EntitlementGuard` **before** the call reaches the provider.

### Entitlement fetch
- AIHub calls `GET {IAM_BASE_URL}/entitlements/models` with the caller's Bearer token.
- The response is cached in-memory per tenant for **5 minutes**.
- Cache is invalidated on expiry — no manual invalidation endpoint.

### Pre-call checks (in order)

1. **Entitlement exists and is allowed** — tenant must have an entitlement row for `(model_key, operation_type)` with `allowed=true`. Missing row or `allowed=false` → 403.
2. **RPM limit** — Redis `INCR aihub:rpm:{tenant_id}:{model_key}:{op}` with 60 s TTL. Count is incremented *before* the call so in-flight requests count. If count exceeds limit → 429.
3. **TPM limit** — reads current minute bucket from Redis. If at or above limit → 429.
4. **Daily token limit** — reads current UTC day bucket from Redis. If at or above limit → 429.
5. **Monthly token limit** — reads current UTC month bucket from Redis. If at or above limit → 429.

### Post-call accounting (best-effort)

After a successful call, AIHub increments token counters in Redis using a pipeline:
- `aihub:tpm:{tenant_id}:{model_key}:{op}:{minute}` — TTL 120 s
- `aihub:daily:{tenant_id}:{model_key}:{op}:{YYYY-MM-DD}` — TTL 25 hours
- `aihub:monthly:{tenant_id}:{model_key}:{op}:{YYYY-MM}` — TTL 32 days

If Redis is unavailable, the increment fails silently and the call is still served. The trade-off is that concurrent in-flight requests may slightly overshoot token limits within a single request window.

---

## 8. Usage Logging

Every completed request (success or error) is logged to `model_usage_logs`.

Fields logged per call:
- `tenant_id`, `workspace_id`, `user_id` / `service_client_id` — from JWT
- `model_id`, `model_key`, `operation_type` — from model config
- `input_tokens`, `output_tokens` — from provider response
- `cost` — computed as `input_tokens × input_cost + output_tokens × output_cost`
- `status` — `success` | `failed`
- `error_message`, `latency_ms`

Log writes are fire-and-forget — failures do not affect the API response.

Usage logs can be queried via `GET /v1/usage` scoped to the caller's `tenant_id` from the JWT.

---

## 9. Adapter Pattern

The adapter registry is built at startup from active provider rows:

| `adapter_type` | Chat | Embed | Rerank |
|---|---|---|---|
| `openai_compatible` | `OpenAICompatibleChatAdapter` | — | — |
| `local` | — | `LocalEmbedAdapter` | `LocalRerankAdapter` |

If a request arrives for an operation not supported by the provider's adapter type, AIHub returns 400 immediately.

The `OpenAICompatibleChatAdapter` gets the provider API key by decrypting the `api_key` field from `config_json` on the providers row using `PROVIDER_ENCRYPTION_KEY` at startup. No per-provider env vars are needed.

Local adapters share a single instance per `model_dir` and are lazy-loaded per model — the first request for a model triggers the load, subsequent requests reuse the cached instance.
