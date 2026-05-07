-- DataHub Database Schema
-- Clean create-schema file.
-- Multi-tenant + workspace-scoped.
-- IAM owns tenants, users, workspaces, permissions, and service clients.
-- DataHub stores tenant_id / workspace_id / user_id references only.

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. DATASOURCES


CREATE TABLE IF NOT EXISTS datasources (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),

    status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- active, archived, deleted

    created_by_user_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    CONSTRAINT uq_datasources_id_tenant_workspace
        UNIQUE (id, tenant_id, workspace_id),

    CONSTRAINT uq_datasources_tenant_workspace_name
        UNIQUE (tenant_id, workspace_id, name)
);


-- 2. DOCUMENTS


CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    datasource_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(255) NOT NULL,
    storage_path VARCHAR(255) NOT NULL,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    -- uploaded, processing, indexed, failed, archived, deleted
    
    uploaded_by_user_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_documents_id_tenant_workspace
        UNIQUE (id, tenant_id, workspace_id),

    CONSTRAINT uq_documents_tenant_workspace_datasource_file_hash
        UNIQUE (tenant_id, workspace_id, datasource_id, file_hash),

    CONSTRAINT fk_documents_datasource_scope
        FOREIGN KEY (datasource_id, tenant_id, workspace_id)
        REFERENCES datasources(id, tenant_id, workspace_id)
        ON DELETE CASCADE
);


-- 3. INGESTIONS


CREATE TABLE IF NOT EXISTS ingestions (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    document_id UUID NOT NULL,

    chunk_strategy VARCHAR(255) NOT NULL,
    chunk_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    embedding_model VARCHAR(255) NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    created_by_user_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- pending, running, completed, failed, cancelled


    CONSTRAINT uq_ingestions_id_tenant_workspace
        UNIQUE (id, tenant_id, workspace_id),

    CONSTRAINT fk_ingestions_document_scope
        FOREIGN KEY (document_id, tenant_id, workspace_id)
        REFERENCES documents(id, tenant_id, workspace_id)
        ON DELETE CASCADE
);


-- 4. CHUNKS


CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    document_id UUID NOT NULL,
    ingestion_id UUID NOT NULL,

    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_chunks_id_tenant_workspace
        UNIQUE (id, tenant_id, workspace_id),

    CONSTRAINT uq_chunks_ingestion_chunk_index
        UNIQUE (tenant_id, workspace_id, ingestion_id, chunk_index),

    CONSTRAINT fk_chunks_document_scope
        FOREIGN KEY (document_id, tenant_id, workspace_id)
        REFERENCES documents(id, tenant_id, workspace_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_chunks_ingestion_scope
        FOREIGN KEY (ingestion_id, tenant_id, workspace_id)
        REFERENCES ingestions(id, tenant_id, workspace_id)
        ON DELETE CASCADE
);


-- 5. CHUNK EMBEDDINGS - 384 DIMENSIONS


CREATE TABLE IF NOT EXISTS chunk_384dimension (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    chunk_id UUID NOT NULL,
    datasource_id UUID NOT NULL,

    embedding vector(384) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_chunk_384_chunk_scope
        UNIQUE (chunk_id, tenant_id, workspace_id),

    CONSTRAINT fk_chunk_384_chunk_scope
        FOREIGN KEY (chunk_id, tenant_id, workspace_id)
        REFERENCES chunks(id, tenant_id, workspace_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_chunk_384_datasource_scope
        FOREIGN KEY (datasource_id, tenant_id, workspace_id)
        REFERENCES datasources(id, tenant_id, workspace_id)
        ON DELETE CASCADE
);


-- 6. CHUNK EMBEDDINGS - 768 DIMENSIONS


CREATE TABLE IF NOT EXISTS chunk_768dimension (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    chunk_id UUID NOT NULL,
    datasource_id UUID NOT NULL,

    embedding vector(768) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_chunk_768_chunk_scope
        UNIQUE (chunk_id, tenant_id, workspace_id),

    CONSTRAINT fk_chunk_768_chunk_scope
        FOREIGN KEY (chunk_id, tenant_id, workspace_id)
        REFERENCES chunks(id, tenant_id, workspace_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_chunk_768_datasource_scope
        FOREIGN KEY (datasource_id, tenant_id, workspace_id)
        REFERENCES datasources(id, tenant_id, workspace_id)
        ON DELETE CASCADE
);


-- 7. CHUNK EMBEDDINGS - 1024 DIMENSIONS


CREATE TABLE IF NOT EXISTS chunk_1024dimension (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    chunk_id UUID NOT NULL,
    datasource_id UUID NOT NULL,

    embedding vector(1024) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_chunk_1024_chunk_scope
        UNIQUE (chunk_id, tenant_id, workspace_id),

    CONSTRAINT fk_chunk_1024_chunk_scope
        FOREIGN KEY (chunk_id, tenant_id, workspace_id)
        REFERENCES chunks(id, tenant_id, workspace_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_chunk_1024_datasource_scope
        FOREIGN KEY (datasource_id, tenant_id, workspace_id)
        REFERENCES datasources(id, tenant_id, workspace_id)
        ON DELETE CASCADE
);


-- 8. NORMAL QUERY INDEXES


CREATE INDEX IF NOT EXISTS idx_datasources_tenant_workspace
ON datasources (tenant_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_workspace_datasource
ON documents (tenant_id, workspace_id, datasource_id);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_workspace_status
ON documents (tenant_id, workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_ingestions_tenant_workspace_document
ON ingestions (tenant_id, workspace_id, document_id);

CREATE INDEX IF NOT EXISTS idx_ingestions_tenant_workspace_status
ON ingestions (tenant_id, workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_workspace_document
ON chunks (tenant_id, workspace_id, document_id);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_workspace_ingestion
ON chunks (tenant_id, workspace_id, ingestion_id);

CREATE INDEX IF NOT EXISTS idx_chunk_384_tenant_workspace_datasource
ON chunk_384dimension (tenant_id, workspace_id, datasource_id);

CREATE INDEX IF NOT EXISTS idx_chunk_768_tenant_workspace_datasource
ON chunk_768dimension (tenant_id, workspace_id, datasource_id);

CREATE INDEX IF NOT EXISTS idx_chunk_1024_tenant_workspace_datasource
ON chunk_1024dimension (tenant_id, workspace_id, datasource_id);


-- 9. VECTOR INDEXES

-- These use cosine distance:
--   embedding <=> query_embedding
--
-- Requires pgvector with HNSW support.

CREATE INDEX IF NOT EXISTS idx_chunk_384_embedding_hnsw
ON chunk_384dimension
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_chunk_768_embedding_hnsw
ON chunk_768dimension
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_chunk_1024_embedding_hnsw
ON chunk_1024dimension
USING hnsw (embedding vector_cosine_ops);