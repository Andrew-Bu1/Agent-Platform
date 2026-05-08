-- Add base_url and adapter_type to providers so the adapter registry
-- can be built entirely from DB rows without hardcoded provider names in code.

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS base_url     TEXT         NULL,
    ADD COLUMN IF NOT EXISTS adapter_type VARCHAR(50)  NOT NULL DEFAULT 'openai_compatible',
    ADD COLUMN IF NOT EXISTS config_json  JSONB        NOT NULL DEFAULT '{}'::jsonb;

-- adapter_type values:
--   openai_compatible  →  any OpenAI-format API (OpenRouter, OpenAI, Gemini via openai sdk, etc.)
--   local              →  self-hosted models loaded in-process (embedding, reranking)

COMMENT ON COLUMN providers.adapter_type IS
    'Determines which code adapter handles requests for this provider. '
    'openai_compatible | local';
