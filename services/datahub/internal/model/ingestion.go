package model

import (
	"time"

	"github.com/google/uuid"
)
type Ingestion struct {
	ID 				uuid.UUID	`db:"id"`
	DocumentID 		uuid.UUID 	`db:"document_id"`
	ChunkStrategy 	string 		`db:"chunk_strategy"`
	EmbeddingModel	string 		`db:"embedding_model"`
	Status 			string 		`db:"status"`
	CreatedAt   	time.Time 	`db:"created_at"`
	UpdatedAt   	time.Time 	`db:"updated_at"`
}

type CreateIngestionRequest struct {
	DocumentID 		uuid.UUID 	`json:"document_id"`
	ChunkStrategy 	string 		`json:"chunk_strategy"`
	EmbeddingModel	string 		`json:"embedding_model"`
}

type IngestionResponse struct {
	ID 				uuid.UUID	`json:"id"`
	DocumentID 		uuid.UUID 	`json:"document_id"`
	ChunkStrategy 	string 		`json:"chunk_strategy"`
	EmbeddingModel	string 		`json:"embedding_model"`
	Status 			string 		`json:"status"`
	CreatedAt   	time.Time 	`json:"created_at"`
	UpdatedAt   	time.Time 	`json:"updated_at"`
}


func (i *Ingestion) ToResponse() IngestionResponse {
	return IngestionResponse{
		ID: i.ID,
		DocumentID: i.DocumentID,
		ChunkStrategy: i.ChunkStrategy,
		EmbeddingModel: i.EmbeddingModel,
		Status: i.Status,
		CreatedAt: i.CreatedAt,
		UpdatedAt: i.UpdatedAt,
	}
}