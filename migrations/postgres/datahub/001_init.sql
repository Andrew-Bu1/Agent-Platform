CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS datasource (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS document (
    id UUID PRIMARY KEY,
    datasource_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(255) NOT NULL,
    storage_path VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (datasource_id) REFERENCES datasource(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingestion (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL,
    chunk_strategy VARCHAR(255) NOT NULL,
    chunk_config JSONB NOT NULL,
    embedding_model VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunk (
    id UUID PRIMARY KEY,
    ingestion_id UUID NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (ingestion_id) REFERENCES ingestion(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunk_384dimension (
    id UUID PRIMARY KEY,
    chunk_id UUID NOT NULL,
    datasource_id UUID NOT NULL,
    embedding vector(384) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (chunk_id) REFERENCES chunk(id) ON DELETE CASCADE,
    FOREIGN KEY (datasource_id) REFERENCES datasource(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunk_768dimension (
    id UUID PRIMARY KEY,
    chunk_id UUID NOT NULL,
    datasource_id UUID NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (chunk_id) REFERENCES chunk(id) ON DELETE CASCADE,
    FOREIGN KEY (datasource_id) REFERENCES datasource(id) ON DELETE CASCADE
);