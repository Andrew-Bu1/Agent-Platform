-- Seed the built-in "local" provider for in-process embedding and reranking.
--
-- This provider uses adapter_type='local', which maps to LocalEmbedAdapter and
-- LocalRerankAdapter in the Python registry (adapters/registry.py).  Models that
-- reference this provider_key will be executed in-process via SentenceTransformer
-- (embedding) or CrossEncoder (reranking) rather than through an external API.
--
-- base_url and config_json are intentionally NULL / empty — local adapters load
-- model weights from the file-system path configured via the MODEL_DIR env var.
--
-- Migration is idempotent (ON CONFLICT … DO NOTHING).

INSERT INTO providers (
    id,
    provider_key,
    display_name,
    description,
    logo_url,
    base_url,
    adapter_type,
    config_json,
    is_active,
    sort_order,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'local',
    'Local (Self-Hosted)',
    'In-process embedding and reranking using locally loaded HuggingFace models. '
    'No external API call is made; models are loaded from the MODEL_DIR directory '
    'or downloaded from HuggingFace Hub on first use.',
    NULL,
    NULL,
    'local',
    '{}'::jsonb,
    TRUE,
    0,
    NOW(),
    NOW()
)
ON CONFLICT (provider_key) DO NOTHING;
