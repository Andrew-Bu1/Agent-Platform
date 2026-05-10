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

// Create saves a new ingestion with status "pending" and immediately
// enqueues a ChunkJob so the data-worker starts chunking the document.
func (s *IngestionService) Create(
	ctx context.Context, 
	req model.CreateIngestionRequest, 
	documentID uuid.UUID,
	chunkConfig json.RawMessage,
	tenantID, workspaceID uuid.UUID,
) (*model.IngestionResponse, error) {
	doc, err := s.documentRepo.GetByID(ctx, documentID, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	now := time.Now().UTC()
	i := &model.Ingestion{
		ID:             uuid.New(),
		TenantID:       tenantID,
		WorkspaceID:    workspaceID,
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
		TenantID:       tenantID,
		WorkspaceID:    workspaceID,
		StoragePath:    doc.StoragePath,
		Filename:       doc.Name,
		ChunkStrategy:  i.ChunkStrategy,
		ChunkConfig:    i.ChunkConfig,
		EmbeddingModel: i.EmbeddingModel,
	}
	if err := s.queue.Publish(ctx, job); err != nil {
		// Delete the orphaned row — the client gets a 500 and can retry.
		_ = s.repo.Delete(ctx, i.ID, tenantID, workspaceID)
		return nil, fmt.Errorf("failed to enqueue chunk job: %w", err)
	}

	resp := i.ToResponse()
	return &resp, nil
}

func (s *IngestionService) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.IngestionResponse, error) {
	i, err := s.repo.GetByID(ctx, id, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}
	resp := i.ToResponse()
	return &resp, nil
}

func (s *IngestionService) GetByDocumentID(ctx context.Context, documentID, tenantID, workspaceID uuid.UUID) ([]model.IngestionResponse, error) {
	ingestions, err := s.repo.GetByDocumentID(ctx, documentID, tenantID, workspaceID)
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

func (s *IngestionService) Delete(ctx context.Context, id, tenantID, workspaceID uuid.UUID) error {
	return s.repo.Delete(ctx, id, tenantID, workspaceID)
}