package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"services/datahub/internal/model"
	"services/datahub/internal/queue"
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
	repo         *repository.IngestionRepository
	documentRepo *repository.DocumentRepository
	queue        *queue.RedisQueue
}

func NewIngestionService(
	repo *repository.IngestionRepository,
	documentRepo *repository.DocumentRepository,
	q *queue.RedisQueue,
) *IngestionService {
	return &IngestionService{repo: repo, documentRepo: documentRepo, queue: q}
}

// Create saves a new ingestion with status "processing" and immediately
// enqueues a ChunkJob so the data-worker starts chunking the document.
func (s *IngestionService) Create(
	ctx context.Context, 
	req model.CreateIngestionRequest, 
	documentID uuid.UUID,
	chunkConfig json.RawMessage,
) (*model.IngestionResponse, error) {
	doc, err := s.documentRepo.GetByID(ctx, documentID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	now := time.Now().UTC()
	i := &model.Ingestion{
		ID:             uuid.New(),
		DocumentID:     documentID,
		ChunkStrategy:  req.ChunkStrategy,
		ChunkConfig: 	chunkConfig,
		EmbeddingModel: req.EmbeddingModel,
		Status:         IngestionStatusPending,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.Insert(ctx, i); err != nil {
		return nil, err
	}

	job := queue.ChunkJob{
		IngestionID:    i.ID,
		DocumentID:     i.DocumentID,
		StoragePath:    doc.StoragePath,
		ChunkStrategy:  i.ChunkStrategy,
		ChunkConfig:    i.ChunkConfig,
		EmbeddingModel: i.EmbeddingModel,
	}
	if err := s.queue.Publish(ctx, job); err != nil {
		// Roll back status so the record is not stuck in processing
		_ = s.repo.UpdateStatus(ctx, i.ID, IngestionStatusPending)
		return nil, fmt.Errorf("failed to enqueue chunk job: %w", err)
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