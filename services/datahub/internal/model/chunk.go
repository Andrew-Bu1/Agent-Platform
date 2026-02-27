package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Chunk struct {
	ID          uuid.UUID       `db:"id"`
	IngestionID uuid.UUID       `db:"ingestion_id"`
	ChunkIndex  int             `db:"chunk_index"`
	Content     string          `db:"content"`
	Metadata    json.RawMessage `db:"metadata" swaggertype:"object"`
	CreatedAt   time.Time       `db:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at"`
}

type ChunkResponse struct {
	ID          uuid.UUID       `json:"id"`	
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
		IngestionID: c.IngestionID,
		ChunkIndex:  c.ChunkIndex,
		Content:     c.Content,
		Metadata:    c.Metadata,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}