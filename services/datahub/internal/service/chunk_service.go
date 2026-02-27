package service

import (
	"context"

	"services/datahub/internal/model"
	"services/datahub/internal/repository"

	"github.com/google/uuid"
)

type ChunkService struct {
	repo *repository.ChunkRepository
}

func NewChunkService(repo *repository.ChunkRepository) *ChunkService {
	return &ChunkService{repo: repo}
}

func (s *ChunkService) GetByID(ctx context.Context, id uuid.UUID) (*model.ChunkResponse, error) {
	c, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := c.ToResponse()
	return &resp, nil
}

func (s *ChunkService) GetByIngestionID(ctx context.Context, ingestionID uuid.UUID) ([]model.ChunkResponse, error) {
	chunks, err := s.repo.GetByIngestionID(ctx, ingestionID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChunkResponse, len(chunks))
	for i, c := range chunks {
		responses[i] = c.ToResponse()
	}
	return responses, nil
}
