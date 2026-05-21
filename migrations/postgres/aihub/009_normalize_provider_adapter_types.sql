-- Keep provider adapter types aligned with the adapters AIHub actually registers.
-- Older UI builds offered values such as "openai" and "custom"; those providers
-- were ignored by adapters/registry.py and then failed with
-- "Provider '<key>' does not support chat".

UPDATE providers
SET adapter_type = 'openai_compatible',
    updated_at = NOW()
WHERE adapter_type NOT IN ('openai_compatible', 'local');

ALTER TABLE providers
    DROP CONSTRAINT IF EXISTS chk_providers_adapter_type;

ALTER TABLE providers
    ADD CONSTRAINT chk_providers_adapter_type
    CHECK (adapter_type IN ('openai_compatible', 'local'));
