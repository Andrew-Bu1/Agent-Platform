-- Migration 002: add active_ingestion_id to documents
-- An active ingestion marks which ingestion run's chunks are used for vector search.
-- NULL means the document has not been activated for search yet.

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS active_ingestion_id UUID NULL;

-- Composite FK ensures the referenced ingestion belongs to the same tenant/workspace.
ALTER TABLE documents
    ADD CONSTRAINT fk_documents_active_ingestion
        FOREIGN KEY (active_ingestion_id, tenant_id, workspace_id)
        REFERENCES ingestions (id, tenant_id, workspace_id)
        ON DELETE SET NULL;
