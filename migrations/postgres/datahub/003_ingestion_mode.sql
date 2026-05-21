-- V3: Add mode column to ingestions.
-- mode: 'full_pipeline' (default, chunk + embed) | 'chunk_only' (stop after chunking)
-- For chunk_only runs, embedding_model is stored as empty string.
-- Existing rows default to 'full_pipeline'.

ALTER TABLE ingestions
    ADD COLUMN IF NOT EXISTS mode VARCHAR(50) NOT NULL DEFAULT 'full_pipeline';
