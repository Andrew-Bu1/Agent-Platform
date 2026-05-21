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
	IngestionStatusChunked    = "chunked"
	IngestionStatusCompleted  = "completed"
	IngestionStatusFailed     = "failed"

	IngestionModeFull      = "full_pipeline"
	IngestionModeChunkOnly = "chunk_only"
)



type IngestionService struct {
	repo         *repository.IngestionRepository
	documentRepo *repository.DocumentRepository
	chunkRepo    *repository.ChunkRepository
	queue        *queue.RedisQueue
}

func NewIngestionService(
	repo *repository.IngestionRepository,
	documentRepo *repository.DocumentRepository,
	chunkRepo *repository.ChunkRepository,
	q *queue.RedisQueue,
) *IngestionService {
	return &IngestionService{repo: repo, documentRepo: documentRepo, chunkRepo: chunkRepo, queue: q}
}

// Create saves a new ingestion with status "pending" and immediately
// enqueues an IngestionJob so the data-worker starts the pipeline.
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

	mode := req.Mode
	if mode == "" {
		mode = IngestionModeFull
	}

	now := time.Now().UTC()
	i := &model.Ingestion{
		ID:             uuid.New(),
		TenantID:       tenantID,
		WorkspaceID:    workspaceID,
		DocumentID:     documentID,
		Mode:           mode,
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

	job := queue.IngestionJob{
		IngestionID:    i.ID,
		DocumentID:     i.DocumentID,
		TenantID:       tenantID,
		WorkspaceID:    workspaceID,
		StoragePath:    doc.StoragePath,
		Filename:       doc.Name,
		ChunkStrategy:  i.ChunkStrategy,
		ChunkConfig:    i.ChunkConfig,
		EmbeddingModel: i.EmbeddingModel,
		Mode:           i.Mode,
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

// TriggerEmbed triggers embedding for a chunked ingestion.
// It fetches all chunks for the ingestion, sets the embedding model,
// and pushes an EmbedJob to the embedding queue for each chunk.
func (s *IngestionService) TriggerEmbed(
	ctx context.Context,
	ingestionID uuid.UUID,
	embeddingModel string,
	tenantID, workspaceID uuid.UUID,
) (*model.IngestionResponse, error) {
	ing, err := s.repo.GetByID(ctx, ingestionID, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("ingestion not found: %w", err)
	}
	if ing.Status != IngestionStatusChunked {
		return nil, fmt.Errorf("ingestion must be in 'chunked' status to trigger embedding (current: %s)", ing.Status)
	}

	// Get the document to find datasource_id.
	doc, err := s.documentRepo.GetByID(ctx, ing.DocumentID, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	// Fetch all chunks for this ingestion.
	chunks, err := s.chunkRepo.GetByIngestionID(ctx, ingestionID, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chunks: %w", err)
	}

	// Update the embedding model on the ingestion record.
	if err := s.repo.UpdateEmbeddingModel(ctx, ingestionID, embeddingModel); err != nil {
		return nil, err
	}

	if len(chunks) == 0 {
		// No chunks — mark completed immediately.
		_ = s.repo.UpdateStatus(ctx, ingestionID, IngestionStatusCompleted)
		ing.EmbeddingModel = embeddingModel
		ing.Status = IngestionStatusCompleted
		resp := ing.ToResponse()
		return &resp, nil
	}

	// Set the embed-completion counter BEFORE pushing jobs.
	counterKey := fmt.Sprintf("datahub:embed:remaining:%s", ingestionID)
	if err := s.queue.SetCounter(ctx, counterKey, int64(len(chunks))); err != nil {
		return nil, fmt.Errorf("set embed counter: %w", err)
	}

	// Update status to processing.
	if err := s.repo.UpdateStatus(ctx, ingestionID, IngestionStatusProcessing); err != nil {
		return nil, err
	}

	// Push an EmbedJob for every chunk.
	for _, ch := range chunks {
		job := queue.EmbedJob{
			IngestionID:    ingestionID.String(),
			ChunkID:        ch.ID.String(),
			DatasourceID:   doc.DatasourceID.String(),
			TenantID:       tenantID.String(),
			WorkspaceID:    workspaceID.String(),
			Content:        ch.Content,
			EmbeddingModel: embeddingModel,
		}
		if err := s.queue.PublishEmbed(ctx, job); err != nil {
			return nil, fmt.Errorf("publish embed job for chunk %s: %w", ch.ID, err)
		}
	}

	ing.EmbeddingModel = embeddingModel
	ing.Status = IngestionStatusProcessing
	resp := ing.ToResponse()
	return &resp, nil
}