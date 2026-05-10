-- V2: Add tool_ids column to agents.
-- The agent-worker reads this column directly to resolve which tools the agent has.
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS tool_ids UUID[] NOT NULL DEFAULT '{}';
