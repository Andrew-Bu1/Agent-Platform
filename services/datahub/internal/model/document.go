package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Document struct {
	ID           uuid.UUID       `db:"id"`
	DatasourceID uuid.UUID       `db:"datasource_id"`
	Name		 string          `db:"name"`
	FileHash     string          `db:"file_hash"`
	StoragePath  string          `db:"storage_path"`
	Metadata     json.RawMessage `db:"metadata" swaggertype:"object"`
	CreatedAt    time.Time       `db:"created_at"`
	UpdatedAt    time.Time       `db:"updated_at"`
}

type CreateDocumentRequest struct {
	DatasourceID uuid.UUID       `json:"datasource_id"`
	Metadata     json.RawMessage `json:"metadata,omitempty" swaggertype:"object"`
}

type UpdateDocumentRequest struct {
	StoragePath *string         `json:"storage_path,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty" swaggertype:"object"`
}

type DocumentResponse struct {
	ID           uuid.UUID       `json:"id"`
	DatasourceID uuid.UUID       `json:"datasource_id"`
	Name		 string          `json:"name"`
	StoragePath  string          `json:"storage_path"`
	Metadata     json.RawMessage `json:"metadata,omitempty" swaggertype:"object"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

func (d *Document) ToResponse() DocumentResponse {
	return DocumentResponse{
		ID:           d.ID,
		DatasourceID: d.DatasourceID,
		Name:         d.Name,
		StoragePath:  d.StoragePath,
		Metadata:     d.Metadata,
		CreatedAt:    d.CreatedAt,
		UpdatedAt:    d.UpdatedAt,
	}
}