package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Chunk struct {
	ID          uuid.UUID       `db:"id"`
	TenantID    uuid.UUID       `db:"tenant_id"`
	WorkspaceID uuid.UUID       `db:"workspace_id"`
	DocumentID  uuid.UUID       `db:"document_id"`
	IngestionID uuid.UUID       `db:"ingestion_id"`
	ChunkIndex  int             `db:"chunk_index"`
	Content     string          `db:"content"`
	Metadata    json.RawMessage `db:"metadata" swaggertype:"object"`
	CreatedAt   time.Time       `db:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at"`
}

type ChunkResponse struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	DocumentID  uuid.UUID       `json:"document_id"`
	IngestionID uuid.UUID       `json:"ingestion_id"`
	ChunkIndex  int             `json:"chunk_index"`
	Content     string          `json:"content"`
	Metadata    json.RawMessage `json:"metadata,omitempty" swaggertype:"object"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func (c *Chunk) ToResponse() ChunkResponse {
	return ChunkResponse{
		ID:          c.ID,
		TenantID:    c.TenantID,
		WorkspaceID: c.WorkspaceID,
		DocumentID:  c.DocumentID,
		IngestionID: c.IngestionID,
		ChunkIndex:  c.ChunkIndex,
		Content:     c.Content,
		Metadata:    c.Metadata,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}