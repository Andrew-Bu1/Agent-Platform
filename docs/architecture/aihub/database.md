# AIHub — Database Schema

```mermaid
erDiagram
    providers {
        UUID        id              PK
        VARCHAR100  provider_key    "UNIQUE — openrouter, openai, local, etc."
        VARCHAR255  display_name
        TEXT        description     "nullable"
        TEXT        base_url        "nullable — provider API base URL"
        VARCHAR50   adapter_type    "openai_compatible | local"
        JSONB       config_json     "encrypted api_key stored here"
        BOOLEAN     is_active       "default TRUE"
        INT         sort_order      "default 0"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    model_configs {
        UUID        id                      PK
        UUID        provider_id             FK
        VARCHAR150  model_key               "UNIQUE with operation_type — internal lookup key"
        VARCHAR255  display_name
        TEXT        description             "nullable"
        VARCHAR255  provider_model_id       "actual model ID sent to provider"
        VARCHAR50   operation_type          "chat | embed | rerank"
        VARCHAR100  task_type               "nullable"
        TEXT        endpoint_url            "nullable — per-model override of provider base_url"
        NUMERIC1810 input_cost              "nullable — per input token"
        NUMERIC1810 output_cost             "nullable — per output token"
        INT         context_window_tokens   "nullable"
        INT         max_output_tokens       "nullable"
        INT         embedding_dimensions    "nullable"
        BOOLEAN     supports_streaming      "default FALSE"
        BOOLEAN     supports_tools          "default FALSE"
        BOOLEAN     supports_json_mode      "default FALSE"
        BOOLEAN     supports_vision         "default FALSE"
        JSONB       config_json             "reserved for future per-model config"
        BOOLEAN     is_active               "default TRUE"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    model_usage_logs {
        UUID        id                  PK
        UUID        tenant_id           "NOT NULL — from JWT"
        UUID        workspace_id        "nullable"
        UUID        user_id             "nullable"
        UUID        service_client_id   "nullable"
        UUID        model_id            FK
        VARCHAR150  model_key           "denormalized for fast querying"
        VARCHAR50   operation_type      "chat | embed | rerank"
        VARCHAR255  feature_key         "nullable — which platform feature called this"
        BIGINT      input_tokens        "default 0"
        BIGINT      output_tokens       "default 0"
        NUMERIC1810 cost                "default 0"
        VARCHAR50   status              "success | failed | rejected | timeout"
        TEXT        error_message       "nullable"
        INT         latency_ms          "nullable"
        JSONB       metadata_json       "reserved"
        TIMESTAMPTZ created_at
    }

    providers ||--o{ model_configs : "one provider, many models"
    model_configs ||--o{ model_usage_logs : "logged per call"
```

## Key design decisions

- `provider_key` is the stable external identifier (e.g. `openrouter`). The UUID `id` is only used for FK references.
- `model_key` + `operation_type` is unique — the same model name can appear as both `chat` and `embed` if the provider supports both operations.
- `provider_model_id` decouples AIHub's internal key from the upstream model identifier, so renaming a model at a provider only requires a DB update.
- `config_json` on `providers` stores the encrypted API key under `"api_key"`. The plaintext is only available in memory after decryption at startup.
- `model_usage_logs.tenant_id NOT NULL` — every log row is scoped to a tenant.
- `model_usage_logs.model_key` is denormalized so log queries don't require a JOIN with `model_configs`.
