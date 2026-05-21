package model

import "encoding/json"

// IngestionJob is pushed to REDIS_INGESTION_QUEUE by the datahub service.
// It contains everything needed to download and process a document.
type IngestionJob struct {
	IngestionID    string          `json:"ingestion_id"`
	DocumentID     string          `json:"document_id"`
	TenantID       string          `json:"tenant_id"`
	WorkspaceID    string          `json:"workspace_id"`
	StoragePath    string          `json:"storage_path"` // object name in MinIO
	Filename       string          `json:"filename"`
	ChunkStrategy  string          `json:"chunk_strategy"` // fixed_size | recursive_split | semantic_chunking
	ChunkConfig    json.RawMessage `json:"chunk_config"`
	EmbeddingModel string          `json:"embedding_model"`
	Mode           string          `json:"mode"` // "full_pipeline" | "chunk_only"
}

// ChunkingJob is pushed to REDIS_CHUNKING_QUEUE after the file has been
// downloaded and its text extracted. It carries the raw text so the chunk
// worker can apply the requested strategy without touching storage again.
type ChunkingJob struct {
	IngestionID    string          `json:"ingestion_id"`
	DocumentID     string          `json:"document_id"`
	TenantID       string          `json:"tenant_id"`
	WorkspaceID    string          `json:"workspace_id"`
	Text           string          `json:"text"`
	ChunkStrategy  string          `json:"chunk_strategy"`
	ChunkConfig    json.RawMessage `json:"chunk_config"`
	EmbeddingModel string          `json:"embedding_model"`
	Mode           string          `json:"mode"` // "full_pipeline" | "chunk_only"
}

// EmbedJob is pushed to REDIS_EMBEDDING_QUEUE for every individual chunk.
// The embed worker calls AIHub with the content and stores the resulting vector.
type EmbedJob struct {
	IngestionID    string `json:"ingestion_id"`
	ChunkID        string `json:"chunk_id"`
	DatasourceID   string `json:"datasource_id"`
	TenantID       string `json:"tenant_id"`
	WorkspaceID    string `json:"workspace_id"`
	Content        string `json:"content"`
	EmbeddingModel string `json:"embedding_model"`
}
