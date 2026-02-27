package service

import (
	"context"
	"time"

	"services/datahub/internal/model"
	"services/datahub/internal/repository"

	"github.com/google/uuid"
)

const (
	IngestionStatusPending    = "pending"
	IngestionStatusProcessing = "processing"
	IngestionStatusCompleted  = "completed"
	IngestionStatusFailed     = "failed"
)

type IngestionService struct {
	repo *repository.IngestionRepository
}

func NewIngestionService(repo *repository.IngestionRepository) *IngestionService {
	return &IngestionService{repo: repo}
}

func (s *IngestionService) Create(ctx context.Context, req model.CreateIngestionRequest) (*model.IngestionResponse, error) {
	now := time.Now().UTC()
	i := &model.Ingestion{
		ID:             uuid.New(),
		DocumentID:     req.DocumentID,
		ChunkStrategy:  req.ChunkStrategy,
		EmbeddingModel: req.EmbeddingModel,
		Status:         IngestionStatusPending,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.Insert(ctx, i); err != nil {
		return nil, err
	}

	resp := i.ToResponse()
	return &resp, nil
}

func (s *IngestionService) GetByID(ctx context.Context, id uuid.UUID) (*model.IngestionResponse, error) {
	i, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := i.ToResponse()
	return &resp, nil
}

func (s *IngestionService) GetByDocumentID(ctx context.Context, documentID uuid.UUID) ([]model.IngestionResponse, error) {
	ingestions, err := s.repo.GetByDocumentID(ctx, documentID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.IngestionResponse, len(ingestions))
	for i, ing := range ingestions {
		responses[i] = ing.ToResponse()
	}
	return responses, nil
}

func (s *IngestionService) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	return s.repo.UpdateStatus(ctx, id, status)
}

func (s *IngestionService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
