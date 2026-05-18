-- Seed: Latest models (2025-2026 releases)
-- OpenRouter:  IDs 0010-000000000008 … 0010-000000000016
-- OpenAI:      IDs 0020-000000000006 … 0020-000000000008
-- Safe to re-run (ON CONFLICT DO NOTHING).

DO $$
DECLARE
    or_id uuid;
    oa_id uuid;
BEGIN

SELECT id INTO or_id FROM providers WHERE provider_key = 'openrouter' AND is_active = TRUE;
SELECT id INTO oa_id FROM providers WHERE provider_key = 'openai'      AND is_active = TRUE;

-- ── OpenRouter ───────────────────────────────────────────────────────────────

IF or_id IS NOT NULL THEN

    -- Claude 3.7 Sonnet (Feb 2025) — latest Anthropic flagship
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000008', or_id,
        'openrouter/claude-3-7-sonnet', 'Claude 3.7 Sonnet (OpenRouter)',
        'Anthropic Claude 3.7 Sonnet — extended thinking, 200k context.',
        'anthropic/claude-3-7-sonnet', 'chat',
        200000, 64000,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- DeepSeek V3 0324 (Mar 2025) — latest DeepSeek V3 snapshot
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000009', or_id,
        'openrouter/deepseek-v3-0324', 'DeepSeek V3 0324 (OpenRouter)',
        'DeepSeek V3 March-2025 snapshot — fast MoE, excellent coding.',
        'deepseek/deepseek-chat-v3-0324', 'chat',
        128000, 8000,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- DeepSeek R1 0528 (May 2025) — latest R1 reasoning snapshot
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000010', or_id,
        'openrouter/deepseek-r1-0528', 'DeepSeek R1 0528 (OpenRouter)',
        'DeepSeek R1 May-2025 — improved reasoning, open-source.',
        'deepseek/deepseek-r1-0528', 'chat',
        128000, 32000,
        TRUE, FALSE, FALSE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Qwen3 235B A22B (Apr 2025) — flagship MoE
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000011', or_id,
        'openrouter/qwen3-235b', 'Qwen3 235B A22B (OpenRouter)',
        'Alibaba Qwen3-235B-A22B — top-tier MoE with thinking mode.',
        'qwen/qwen3-235b-a22b', 'chat',
        128000, 8000,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Qwen3 30B A3B (Apr 2025) — efficient MoE
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000012', or_id,
        'openrouter/qwen3-30b', 'Qwen3 30B A3B (OpenRouter)',
        'Alibaba Qwen3-30B-A3B — efficient MoE, fast and affordable.',
        'qwen/qwen3-30b-a3b', 'chat',
        128000, 8000,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Mistral Large 3 — latest Mistral flagship
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000013', or_id,
        'openrouter/mistral-large-3', 'Mistral Large 3 (OpenRouter)',
        'Mistral Large 3 — frontier model with 128k context and strong reasoning.',
        'mistralai/mistral-large-3', 'chat',
        128000, 8000,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Llama 4 Scout (Apr 2025) — 10M context, multimodal
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000014', or_id,
        'openrouter/llama-4-scout', 'Llama 4 Scout (OpenRouter)',
        'Meta Llama 4 Scout — 10M token context, vision, MoE (109B/17B active).',
        'meta-llama/llama-4-scout', 'chat',
        10000000, 16000,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Llama 4 Maverick (Apr 2025) — 1M context, higher quality
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000015', or_id,
        'openrouter/llama-4-maverick', 'Llama 4 Maverick (OpenRouter)',
        'Meta Llama 4 Maverick — 1M context, vision, higher quality MoE (400B/17B active).',
        'meta-llama/llama-4-maverick', 'chat',
        1000000, 16000,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Gemini 2.5 Pro (Mar 2025) — best Gemini, 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000016', or_id,
        'openrouter/gemini-2.5-pro', 'Gemini 2.5 Pro (OpenRouter)',
        'Google Gemini 2.5 Pro — 1M context, thinking, multimodal flagship.',
        'google/gemini-2.5-pro-preview', 'chat',
        1048576, 65535,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- GPT-4.1 via OpenRouter (Apr 2025) — 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000017', or_id,
        'openrouter/gpt-4.1', 'GPT-4.1 (OpenRouter)',
        'OpenAI GPT-4.1 via OpenRouter — 1M context, frontier coding and instruction following.',
        'openai/gpt-4.1', 'chat',
        1047576, 32768,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

END IF;

-- ── OpenAI direct ────────────────────────────────────────────────────────────

IF oa_id IS NOT NULL THEN

    -- GPT-4.1 (Apr 2025) — 1M context, best instruction following
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000006', oa_id,
        'openai/gpt-4.1', 'GPT-4.1',
        'OpenAI GPT-4.1 — 1M context, best coding and instruction following.',
        'gpt-4.1', 'chat',
        1047576, 32768,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- GPT-4.1 Mini (Apr 2025) — affordable 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000007', oa_id,
        'openai/gpt-4.1-mini', 'GPT-4.1 Mini',
        'OpenAI GPT-4.1 Mini — affordable 1M-context model, great for high-volume tasks.',
        'gpt-4.1-mini', 'chat',
        1047576, 32768,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- o3 (Apr 2025) — top reasoning model
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000008', oa_id,
        'openai/o3', 'o3',
        'OpenAI o3 — top-tier reasoning model for complex math, science, and coding.',
        'o3', 'chat',
        200000, 100000,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

END IF;

-- ── Backfill: input_cost / output_cost ($ per 1M tokens) ───────────────────
UPDATE model_configs SET input_cost = 3.0000000000,  output_cost = 15.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000008';
UPDATE model_configs SET input_cost = 0.2000000000,  output_cost = 0.7700000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000009';
UPDATE model_configs SET input_cost = 0.5000000000,  output_cost = 2.1500000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000010';
UPDATE model_configs SET input_cost = 0.1400000000,  output_cost = 0.6000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000011';
UPDATE model_configs SET input_cost = 0.0200000000,  output_cost = 0.1000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000012';
UPDATE model_configs SET input_cost = 0.5000000000,  output_cost = 1.5000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000013';
UPDATE model_configs SET input_cost = 0.0800000000,  output_cost = 0.3000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000014';
UPDATE model_configs SET input_cost = 0.1500000000,  output_cost = 0.6000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000015';
UPDATE model_configs SET input_cost = 1.2500000000,  output_cost = 10.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000016';
UPDATE model_configs SET input_cost = 2.0000000000,  output_cost = 8.0000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000017';
UPDATE model_configs SET input_cost = 2.0000000000,  output_cost = 8.0000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000006';
UPDATE model_configs SET input_cost = 0.4000000000,  output_cost = 1.6000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000007';
UPDATE model_configs SET input_cost = 10.0000000000, output_cost = 40.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000008';

END $$;
