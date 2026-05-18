-- Seed: New Gemini, Qwen, and DeepSeek models (May 2026)
-- OpenRouter:  IDs 0010-000000000018 … 0010-000000000027
-- Safe to re-run (ON CONFLICT DO NOTHING).

DO $$
DECLARE
    or_id uuid;
BEGIN

SELECT id INTO or_id FROM providers WHERE provider_key = 'openrouter' AND is_active = TRUE;

IF or_id IS NOT NULL THEN

    -- ── Gemini ───────────────────────────────────────────────────────────────

    -- Gemini 2.5 Flash (Jun 2025) — fast reasoning workhorse, 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000018', or_id,
        'openrouter/gemini-2.5-flash', 'Gemini 2.5 Flash (OpenRouter)',
        'Google Gemini 2.5 Flash — fast reasoning with built-in thinking, 1M context.',
        'google/gemini-2.5-flash', 'chat',
        1048576, 65535,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Gemini 3 Flash Preview (Dec 2025) — near-Pro reasoning, agentic workflows
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000019', or_id,
        'openrouter/gemini-3-flash-preview', 'Gemini 3 Flash Preview (OpenRouter)',
        'Google Gemini 3 Flash Preview — near-Pro reasoning with configurable thinking levels, 1M context.',
        'google/gemini-3-flash-preview', 'chat',
        1048576, 65535,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Gemini 3.1 Pro Preview (Feb 2026) — frontier reasoning, strongest Gemini
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000020', or_id,
        'openrouter/gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview (OpenRouter)',
        'Google Gemini 3.1 Pro Preview — frontier reasoning, strongest Gemini, 1M context.',
        'google/gemini-3.1-pro-preview', 'chat',
        1048576, 65535,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Gemini 3.1 Flash Lite (May 2026) — latest GA efficient model, half cost of 3 Flash
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000021', or_id,
        'openrouter/gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite (OpenRouter)',
        'Google Gemini 3.1 Flash Lite — high-efficiency multimodal, low latency, 1M context.',
        'google/gemini-3.1-flash-lite', 'chat',
        1048576, 65535,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- ── DeepSeek ─────────────────────────────────────────────────────────────

    -- DeepSeek V3.2 (Dec 2025) — GPT-5 class, IMO/IOI gold, DSA architecture
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000022', or_id,
        'openrouter/deepseek-v3.2', 'DeepSeek V3.2 (OpenRouter)',
        'DeepSeek V3.2 — GPT-5 class reasoning with sparse attention (DSA), 131K context.',
        'deepseek/deepseek-v3.2', 'chat',
        131072, 8192,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- DeepSeek V4 Flash (Apr 2026) — newest DeepSeek, 284B/13B active, 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000023', or_id,
        'openrouter/deepseek-v4-flash', 'DeepSeek V4 Flash (OpenRouter)',
        'DeepSeek V4 Flash — 284B/13B active MoE, fast inference, 1M context.',
        'deepseek/deepseek-v4-flash', 'chat',
        1048576, 32768,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- DeepSeek V4 Pro (Apr 2026) — newest DeepSeek flagship, 1.6T/49B active, 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000024', or_id,
        'openrouter/deepseek-v4-pro', 'DeepSeek V4 Pro (OpenRouter)',
        'DeepSeek V4 Pro — 1.6T/49B active flagship MoE, advanced reasoning and coding, 1M context.',
        'deepseek/deepseek-v4-pro', 'chat',
        1048576, 32768,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- ── Qwen ─────────────────────────────────────────────────────────────────

    -- Qwen3 235B A22B Instruct 2507 (Jul 2025) — updated 235B, 262K context, no thinking mode
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000025', or_id,
        'openrouter/qwen3-235b-2507', 'Qwen3 235B A22B 2507 (OpenRouter)',
        'Alibaba Qwen3-235B-A22B-Instruct-2507 — multilingual, strong math and coding, 262K context.',
        'qwen/qwen3-235b-a22b-2507', 'chat',
        262144, 8192,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Qwen3 Coder 480B A35B (Jul 2025) — specialist coding MoE, 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000026', or_id,
        'openrouter/qwen3-coder', 'Qwen3 Coder 480B A35B (OpenRouter)',
        'Alibaba Qwen3-Coder-480B-A35B — specialist agentic coding MoE, 480B/35B active, 1M context.',
        'qwen/qwen3-coder', 'chat',
        1048576, 32768,
        TRUE, TRUE, TRUE, FALSE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Qwen3.6 Plus (Apr 2026) — newest Qwen flagship, hybrid linear+MoE, 1M context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000027', or_id,
        'openrouter/qwen3.6-plus', 'Qwen3.6 Plus (OpenRouter)',
        'Alibaba Qwen3.6 Plus — newest Qwen flagship, hybrid linear+MoE, 78.8 SWE-bench, 1M context.',
        'qwen/qwen3.6-plus', 'chat',
        1048576, 32768,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

END IF;

-- ── Backfill: input_cost / output_cost ($ per 1M tokens) ───────────────────
UPDATE model_configs SET input_cost = 0.3000000000,  output_cost = 2.5000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000018';
UPDATE model_configs SET input_cost = 0.5000000000,  output_cost = 3.0000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000019';
UPDATE model_configs SET input_cost = 2.0000000000,  output_cost = 12.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000020';
UPDATE model_configs SET input_cost = 0.2500000000,  output_cost = 1.5000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000021';
UPDATE model_configs SET input_cost = 0.2520000000,  output_cost = 0.3780000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000022';
UPDATE model_configs SET input_cost = 0.1120000000,  output_cost = 0.2240000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000023';
UPDATE model_configs SET input_cost = 0.4350000000,  output_cost = 0.8700000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000024';
UPDATE model_configs SET input_cost = 0.0710000000,  output_cost = 0.1000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000025';
UPDATE model_configs SET input_cost = 0.2200000000,  output_cost = 1.8000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000026';
UPDATE model_configs SET input_cost = 0.3250000000,  output_cost = 1.9500000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000027';

END $$;
