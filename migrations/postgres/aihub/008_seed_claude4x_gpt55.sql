-- Seed: Claude 4.x family + GPT-5.5 (May 2026)
-- OpenRouter: IDs 0010-000000000028 … 0010-000000000033
-- OpenAI:     IDs 0020-000000000009 … 0020-000000000009
-- Safe to re-run (ON CONFLICT DO NOTHING).

DO $$
DECLARE
    or_id uuid;
    oa_id uuid;
BEGIN

SELECT id INTO or_id FROM providers WHERE provider_key = 'openrouter' AND is_active = TRUE;
SELECT id INTO oa_id FROM providers WHERE provider_key = 'openai'      AND is_active = TRUE;

-- ── OpenRouter — Claude 4.x + GPT-5.5 ───────────────────────────────────────

IF or_id IS NOT NULL THEN

    -- Claude Sonnet 4.6 (Feb 2026) — most capable Sonnet, frontier coding + agents
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000028', or_id,
        'openrouter/claude-sonnet-4.6', 'Claude Sonnet 4.6 (OpenRouter)',
        'Anthropic Claude Sonnet 4.6 — frontier coding and agents, 1M context.',
        'anthropic/claude-sonnet-4.6', 'chat',
        1000000, 64000,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Claude Opus 4.6 (Feb 2026) — strongest coding + long-running professional tasks
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000029', or_id,
        'openrouter/claude-opus-4.6', 'Claude Opus 4.6 (OpenRouter)',
        'Anthropic Claude Opus 4.6 — strongest model for coding and long-running agentic tasks, 1M context.',
        'anthropic/claude-opus-4.6', 'chat',
        1000000, 32000,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Claude Opus 4.7 (Apr 2026) — next-gen Opus, async agents, multi-step tasks
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000030', or_id,
        'openrouter/claude-opus-4.7', 'Claude Opus 4.7 (OpenRouter)',
        'Anthropic Claude Opus 4.7 — built for long-running async agents and complex multi-step tasks, 1M context.',
        'anthropic/claude-opus-4.7', 'chat',
        1000000, 32000,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Claude Haiku 4.5 (Oct 2025) — fastest Claude, frontier-level at Haiku cost
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000031', or_id,
        'openrouter/claude-haiku-4.5', 'Claude Haiku 4.5 (OpenRouter)',
        'Anthropic Claude Haiku 4.5 — fastest Claude, >73% SWE-bench, 200K context.',
        'anthropic/claude-haiku-4.5', 'chat',
        200000, 16000,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- GPT-5.5 via OpenRouter (Apr 2026) — OpenAI frontier, 1M+ context
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0010-000000000032', or_id,
        'openrouter/gpt-5.5', 'GPT-5.5 (OpenRouter)',
        'OpenAI GPT-5.5 — frontier model with 1M+ context, stronger reasoning and token efficiency than GPT-5.4.',
        'openai/gpt-5.5', 'chat',
        1048576, 131072,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

END IF;

-- ── OpenAI direct — GPT-5.5 ─────────────────────────────────────────────────

IF oa_id IS NOT NULL THEN

    -- GPT-5.5 direct (Apr 2026) — latest OpenAI frontier
    INSERT INTO model_configs (
        id, provider_id, model_key, display_name, description,
        provider_model_id, operation_type,
        context_window_tokens, max_output_tokens,
        supports_streaming, supports_tools, supports_json_mode, supports_vision,
        is_active, config_json, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0020-000000000009', oa_id,
        'openai/gpt-5.5', 'GPT-5.5',
        'OpenAI GPT-5.5 — latest frontier model, 1M+ context, stronger reasoning than GPT-5.4.',
        'gpt-5.5', 'chat',
        1048576, 131072,
        TRUE, TRUE, TRUE, TRUE,
        TRUE, '{}', NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

END IF;

-- ── Backfill: input_cost / output_cost ($ per 1M tokens) ───────────────────
UPDATE model_configs SET input_cost = 3.0000000000,  output_cost = 15.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000028';
UPDATE model_configs SET input_cost = 5.0000000000,  output_cost = 25.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000029';
UPDATE model_configs SET input_cost = 5.0000000000,  output_cost = 25.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000030';
UPDATE model_configs SET input_cost = 1.0000000000,  output_cost = 5.0000000000,  updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000031';
UPDATE model_configs SET input_cost = 5.0000000000,  output_cost = 30.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0010-000000000032';
UPDATE model_configs SET input_cost = 5.0000000000,  output_cost = 30.0000000000, updated_at = NOW() WHERE id = '00000000-0000-0000-0020-000000000009';

END $$;
