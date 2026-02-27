package service

import (
	"context"
	"errors"
	"time"

	"services/datahub/internal/model"
	"services/datahub/internal/repository"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var ErrDuplicateFile = errors.New("file with the same hash already exists in this datasource")

type DocumentService struct {
	repo *repository.DocumentRepository
}

func NewDocumentService(repo *repository.DocumentRepository) *DocumentService {
	return &DocumentService{repo: repo}
}

func (s *DocumentService) Create(ctx context.Context, req model.CreateDocumentRequest, name, storagePath, fileHash string) (*model.DocumentResponse, error) {
	existing, err := s.repo.FindByHash(ctx, req.DatasourceID, fileHash)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if existing != nil {
		return nil, ErrDuplicateFile
	}

	now := time.Now().UTC()

	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	d := &model.Document{
		ID:           id,
		DatasourceID: req.DatasourceID,
		Name:         name,
		FileHash:     fileHash,
		StoragePath:  storagePath,
		Metadata:     req.Metadata,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.Insert(ctx, d); err != nil {
		return nil, err
	}

	resp := d.ToResponse()
	return &resp, nil
}

func (s *DocumentService) GetByID(ctx context.Context, id uuid.UUID) (*model.DocumentResponse, error) {
	d, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := d.ToResponse()
	return &resp, nil
}

func (s *DocumentService) GetByDatasourceID(ctx context.Context, datasourceID uuid.UUID) ([]model.DocumentResponse, error) {
	docs, err := s.repo.GetByDatasourceID(ctx, datasourceID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.DocumentResponse, len(docs))
	for i, d := range docs {
		responses[i] = d.ToResponse()
	}
	return responses, nil
}

func (s *DocumentService) Update(ctx context.Context, id uuid.UUID, req model.UpdateDocumentRequest) (*model.DocumentResponse, error) {
	d, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.StoragePath != nil {
		d.StoragePath = *req.StoragePath
	}
	if req.Metadata != nil {
		d.Metadata = req.Metadata
	}
	d.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, d); err != nil {
		return nil, err
	}

	resp := d.ToResponse()
	return &resp, nil
}

func (s *DocumentService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
