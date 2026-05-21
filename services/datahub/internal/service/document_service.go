package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"time"

	"libs/go/common/storage"
	"services/datahub/internal/model"
	"services/datahub/internal/repository"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var ErrDuplicateFile = errors.New("file with the same hash already exists in this datasource")

type DocumentService struct {
	repo          *repository.DocumentRepository
	datasourceRepo *repository.DatasourceRepository
	minio         *storage.MinioStorage
}

func NewDocumentService(repo *repository.DocumentRepository, datasourceRepo *repository.DatasourceRepository, minio *storage.MinioStorage) *DocumentService {
	return &DocumentService{repo: repo, datasourceRepo: datasourceRepo, minio: minio}
}

// Create uploads the file to MinIO then persists the document record.
// The caller passes the raw file bytes; storagePath is computed here.
func (s *DocumentService) Create(ctx context.Context, req model.CreateDocumentRequest, name string, data []byte, fileHash string, tenantID, workspaceID uuid.UUID, createdByUserID *uuid.UUID) (*model.DocumentResponse, error) {
	// Verify the target datasource belongs to the caller's tenant/workspace before
	// accepting the upload. Without this check any authenticated user who knows a
	// foreign datasource UUID could attach documents to it.
	if _, err := s.datasourceRepo.GetByID(ctx, req.DatasourceID, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("datasource not found: %w", err)
	}

	existing, err := s.repo.FindByHash(ctx, req.DatasourceID, tenantID, workspaceID, fileHash)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if existing != nil {
		return nil, ErrDuplicateFile
	}

	// Default empty metadata to avoid a NULL in the JSON column.
	metadata := req.Metadata
	if len(metadata) == 0 {
		metadata = json.RawMessage(`{}`)
	}

	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}

	// Include document ID in the path so two files with the same name in the same
	// datasource never collide. path.Base strips any directory components the client
	// may have included in the filename.
	objectName := fmt.Sprintf("%s/%s/%s", req.DatasourceID, id, path.Base(name))
	storagePath, err := s.minio.UploadFile(ctx, objectName, data)
	if err != nil {
		return nil, fmt.Errorf("upload to minio: %w", err)
	}

	now := time.Now().UTC()

	d := &model.Document{
		ID:              id,
		TenantID:        tenantID,
		WorkspaceID:     workspaceID,
		DatasourceID:    req.DatasourceID,
		Name:            name,
		FileHash:        fileHash,
		StoragePath:     storagePath,
		Metadata:        metadata,
		Status:          "uploaded",
		CreatedByUserID: createdByUserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.repo.Insert(ctx, d); err != nil {
		// Best-effort cleanup to avoid orphaning the uploaded object.
		_ = s.minio.DeleteFile(ctx, objectName)
		return nil, err
	}

	resp := d.ToResponse()
	return &resp, nil
}

func (s *DocumentService) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.DocumentResponse, error) {
	d, err := s.repo.GetByID(ctx, id, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}
	resp := d.ToResponse()
	return &resp, nil
}

func (s *DocumentService) GetByDatasourceID(ctx context.Context, datasourceID, tenantID, workspaceID uuid.UUID) ([]model.DocumentResponse, error) {
	docs, err := s.repo.GetByDatasourceID(ctx, datasourceID, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.DocumentResponse, len(docs))
	for i, d := range docs {
		responses[i] = d.ToResponse()
	}
	return responses, nil
}

func (s *DocumentService) Update(ctx context.Context, id uuid.UUID, req model.UpdateDocumentRequest, tenantID, workspaceID uuid.UUID) (*model.DocumentResponse, error) {
	d, err := s.repo.GetByID(ctx, id, tenantID, workspaceID)
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

func (s *DocumentService) SetActiveIngestion(ctx context.Context, documentID, ingestionID uuid.UUID, tenantID, workspaceID uuid.UUID) (*model.DocumentResponse, error) {
	// Verify the document belongs to the caller's tenant/workspace.
	if _, err := s.repo.GetByID(ctx, documentID, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}
	if err := s.repo.SetActiveIngestion(ctx, documentID, &ingestionID, tenantID, workspaceID); err != nil {
		return nil, err
	}
	doc, err := s.repo.GetByID(ctx, documentID, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}
	resp := doc.ToResponse()
	return &resp, nil
}

func (s *DocumentService) Delete(ctx context.Context, id, tenantID, workspaceID uuid.UUID) error {
	return s.repo.Delete(ctx, id, tenantID, workspaceID)
}
