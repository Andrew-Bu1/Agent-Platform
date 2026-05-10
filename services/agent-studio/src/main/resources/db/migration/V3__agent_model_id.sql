-- V3: Add model_id column to agents.
-- The agent-worker resolves the model key directly from this column.
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS model_id VARCHAR(255) NULL;
