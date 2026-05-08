package model

import "github.com/google/uuid"

// VectorSearchRequest is the body for POST /datasources/{id}/search.
type VectorSearchRequest struct {
	Vector []float64 `json:"vector"`
	TopK   int       `json:"top_k"`
}

// VectorSearchResult is a single chunk with its cosine similarity score.
type VectorSearchResult struct {
	ChunkID  uuid.UUID `json:"chunk_id"`
	Content  string    `json:"content"`
	Score    float64   `json:"score"`
}
