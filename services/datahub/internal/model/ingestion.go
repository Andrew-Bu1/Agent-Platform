package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)
type Ingestion struct {
	ID 				uuid.UUID			`db:"id"`
	TenantID 		uuid.UUID 			`db:"tenant_id"`
	WorkspaceID 	uuid.UUID 			`db:"workspace_id"`
	DocumentID 		uuid.UUID 			`db:"document_id"`	Mode 			string 				`db:"mode"`	ChunkStrategy 	string 				`db:"chunk_strategy"`
	ChunkConfig		json.RawMessage 	`db:"chunk_config"`
	EmbeddingModel	string 				`db:"embedding_model"`
	Status 			string 				`db:"status"`
	CreatedAt   	time.Time 			`db:"created_at"`
	UpdatedAt   	time.Time 			`db:"updated_at"`
}

type CreateIngestionRequest struct {
	Mode 			string 			`json:"mode"` // "full_pipeline" (default) | "chunk_only"
	ChunkStrategy 	string 			`json:"chunk_strategy"`
	ChunkConfig		map[string]any 	`json:"chunk_config"`
	EmbeddingModel	string 			`json:"embedding_model"` // optional for chunk_only
}

// TriggerEmbedRequest is the body for POST /ingestions/{id}/embed.
// It triggers embedding for a chunked ingestion using the specified model.
type TriggerEmbedRequest struct {
	EmbeddingModel string `json:"embedding_model"`
}

type IngestionResponse struct {
	ID 				uuid.UUID		`json:"id"`
	TenantID 		uuid.UUID 		`json:"tenant_id"`
	WorkspaceID 	uuid.UUID 		`json:"workspace_id"`
	DocumentID 		uuid.UUID 		`json:"document_id"`	Mode 			string 			`json:"mode"`	ChunkStrategy 	string 			`json:"chunk_strategy"`
	ChunkConfig		map[string]any 	`json:"chunk_config"`
	EmbeddingModel	string 			`json:"embedding_model"`
	Status 			string 			`json:"status"`
	CreatedAt   	time.Time 		`json:"created_at"`
	UpdatedAt   	time.Time 		`json:"updated_at"`
}


func (i *Ingestion) ToResponse() IngestionResponse {
	var chunkConfig map[string]any

	if len(i.ChunkConfig) > 0 {
		if err := json.Unmarshal(i.ChunkConfig, &chunkConfig); err != nil {
			chunkConfig = map[string]any{"error": "invalid chunk config"}
		}
	}

	return IngestionResponse{
		ID: i.ID,
		TenantID: i.TenantID,
		WorkspaceID: i.WorkspaceID,
		DocumentID: i.DocumentID,
		Mode: i.Mode,
		ChunkStrategy: i.ChunkStrategy,
		ChunkConfig: chunkConfig,
		EmbeddingModel: i.EmbeddingModel,
		Status: i.Status,
		CreatedAt: i.CreatedAt,
		UpdatedAt: i.UpdatedAt,
	}
}