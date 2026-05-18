-- Seed: OpenRouter + OpenAI model configs
-- Provider IDs are looked up dynamically so this script is safe to re-run
-- after the providers are recreated with different UUIDs.
-- Operation types: chat | embed | rerank

DO $$
DECLARE
    or_id  uuid;   -- openrouter
    oa_id  uuid;   -- openai
BEGIN

SELECT id INTO or_id FROM providers WHERE provider_key = 'openrouter' AND is_active = TRUE;
SELECT id INTO oa_id FROM providers WHERE provider_key = 'openai'      AND is_active = TRUE;

-- ── OpenRouter — Chat models ─────────────────────────────────────────────────

IF or_id IS NOT NULL THEN

    -- GPT-4o via OpenRouter
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000001', or_id,
        'openrouter/gpt-4o', 'GPT-4o (OpenRouter)',
        'OpenAI GPT-4o routed via OpenRouter.',
        'openai/gpt-4o', 'chat',
        128000, 4096,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- GPT-4o Mini via OpenRouter
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000002', or_id,
        'openrouter/gpt-4o-mini', 'GPT-4o Mini (OpenRouter)',
        'OpenAI GPT-4o Mini routed via OpenRouter — fast and cheap.',
        'openai/gpt-4o-mini', 'chat',
        128000, 16384,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Claude 3.5 Sonnet via OpenRouter
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000003', or_id,
        'openrouter/claude-3-5-sonnet', 'Claude 3.5 Sonnet (OpenRouter)',
        'Anthropic Claude 3.5 Sonnet routed via OpenRouter.',
        'anthropic/claude-3-5-sonnet', 'chat',
        200000, 8192,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Claude 3.5 Haiku via OpenRouter
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000004', or_id,
        'openrouter/claude-3-5-haiku', 'Claude 3.5 Haiku (OpenRouter)',
        'Anthropic Claude 3.5 Haiku — fast and affordable via OpenRouter.',
        'anthropic/claude-3-5-haiku', 'chat',
        200000, 8192,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Gemini 2.0 Flash via OpenRouter
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000005', or_id,
        'openrouter/gemini-2.0-flash', 'Gemini 2.0 Flash (OpenRouter)',
        'Google Gemini 2.0 Flash via OpenRouter — very fast multimodal.',
        'google/gemini-2.0-flash-001', 'chat',
        1048576, 8192,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- DeepSeek R1 via OpenRouter (free tier available)
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000006', or_id,
        'openrouter/deepseek-r1', 'DeepSeek R1 (OpenRouter)',
        'DeepSeek R1 reasoning model via OpenRouter.',
        'deepseek/deepseek-r1', 'chat',
        65536, 8000,
        TRUE, FALSE, FALSE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Llama 3.3 70B (free on OpenRouter)
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000007', or_id,
        'openrouter/llama-3.3-70b', 'Llama 3.3 70B (OpenRouter)',
        'Meta Llama 3.3 70B Instruct via OpenRouter.',
        'meta-llama/llama-3.3-70b-instruct', 'chat',
        131072, 8192,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

END IF;

-- ── OpenAI — Chat + Embed models ─────────────────────────────────────────────

IF oa_id IS NOT NULL THEN

    -- GPT-4o
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000001', oa_id,
        'openai/gpt-4o', 'GPT-4o',
        'OpenAI GPT-4o — flagship multimodal model.',
        'gpt-4o', 'chat',
        128000, 4096,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- GPT-4o Mini
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000002', oa_id,
        'openai/gpt-4o-mini', 'GPT-4o Mini',
        'OpenAI GPT-4o Mini — fast and cost-effective.',
        'gpt-4o-mini', 'chat',
        128000, 16384,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- o1-mini
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000003', oa_id,
        'openai/o4-mini', 'o4-mini',
        'OpenAI o4-mini — reasoning model.',
        'o4-mini', 'chat',
        200000, 100000,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- text-embedding-3-small
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        embedding_dimensions,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000004', oa_id,
        'openai/text-embedding-3-small', 'text-embedding-3-small',
        'OpenAI text-embedding-3-small — efficient embedding model (1536-dim).',
        'text-embedding-3-small', 'embed',
        1536,
        FALSE, FALSE, FALSE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- text-embedding-3-large
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        embedding_dimensions,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000005', oa_id,
        'openai/text-embedding-3-large', 'text-embedding-3-large',
        'OpenAI text-embedding-3-large — highest quality embedding (3072-dim).',
        'text-embedding-3-large', 'embed',
        3072,
        FALSE, FALSE, FALSE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

END IF;

-- ── Backfill: input_cost / output_cost ($ per 1M tokens) ───────────────────
UPDATE model_configs SET input_cost = 2.5000000000,  output_cost = 10.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000001';
UPDATE model_configs SET input_cost = 0.1500000000,  output_cost = 0.6000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000002';
UPDATE model_configs SET input_cost = 3.0000000000,  output_cost = 15.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000003';
UPDATE model_configs SET input_cost = 0.8000000000,  output_cost = 4.0000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000004';
UPDATE model_configs SET input_cost = 0.1000000000,  output_cost = 0.4000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000005';
UPDATE model_configs SET input_cost = 0.7000000000,  output_cost = 2.5000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000006';
UPDATE model_configs SET input_cost = 0.1000000000,  output_cost = 0.3200000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000007';
UPDATE model_configs SET input_cost = 2.5000000000,  output_cost = 10.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000001';
UPDATE model_configs SET input_cost = 0.1500000000,  output_cost = 0.6000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000002';
UPDATE model_configs SET input_cost = 1.1000000000,  output_cost = 4.4000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000003';
UPDATE model_configs SET input_cost = 0.0200000000,  output_cost = NULL,           updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000004';
UPDATE model_configs SET input_cost = 0.1300000000,  output_cost = NULL,           updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000005';

END $$;
