CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY NOT NULL,

    provider_key VARCHAR(100) NOT NULL UNIQUE,
    -- openai, anthropic, openrouter, gemini, local

    display_name VARCHAR(255) NOT NULL,
    -- OpenAI, Anthropic, OpenRouter, Google Gemini, Local

    description TEXT NULL,

    logo_url TEXT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    sort_order INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS model_configs (
    id UUID PRIMARY KEY NOT NULL,

    provider_id UUID NOT NULL,

    model_key VARCHAR(150) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    provider_model_id VARCHAR(255) NOT NULL,

    operation_type VARCHAR(50) NOT NULL,
    task_type VARCHAR(100) NULL,

    endpoint_url TEXT NULL,

    input_cost NUMERIC(18, 10) NULL,
    output_cost NUMERIC(18, 10) NULL,

    context_window_tokens INTEGER NULL,
    max_output_tokens INTEGER NULL,
    embedding_dimensions INTEGER NULL,

    supports_streaming BOOLEAN NOT NULL DEFAULT FALSE,
    supports_tools BOOLEAN NOT NULL DEFAULT FALSE,
    supports_json_mode BOOLEAN NOT NULL DEFAULT FALSE,
    supports_vision BOOLEAN NOT NULL DEFAULT FALSE,

    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_model_configs_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_model_configs_model_operation
        UNIQUE (model_key, operation_type)
);

CREATE TABLE IF NOT EXISTS model_usage_logs (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NULL,

    user_id UUID NULL,
    service_client_id UUID NULL,

    model_id UUID NOT NULL,

    model_key VARCHAR(150) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,

    feature_key VARCHAR(255) NULL,

    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,


    cost NUMERIC(18, 10) NOT NULL DEFAULT 0,

    status VARCHAR(50) NOT NULL,
    -- success, failed, rejected, timeout

    error_message TEXT NULL,
    latency_ms INTEGER NULL,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_model_usage_logs_model
        FOREIGN KEY (model_id)
        REFERENCES model_configs(id)
        ON DELETE RESTRICT
);