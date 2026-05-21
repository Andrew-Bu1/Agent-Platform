package repository

import (
	"context"
	"fmt"

	"services/datahub/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DocumentRepository struct {
	db *pgxpool.Pool
}

func NewDocumentRepository(db *pgxpool.Pool) *DocumentRepository {
	return &DocumentRepository{db: db}
}

func (r *DocumentRepository) Insert(ctx context.Context, d *model.Document) error {
	const q = `
		INSERT INTO documents (id, tenant_id, workspace_id, datasource_id, name, file_hash, storage_path, metadata, status, created_by_user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := r.db.Exec(ctx, q,
		d.ID,
		d.TenantID,
		d.WorkspaceID,
		d.DatasourceID,
		d.Name,
		d.FileHash,
		d.StoragePath,
		d.Metadata,
		d.Status,
		d.CreatedByUserID,
		d.CreatedAt,
		d.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("DocumentRepository.Insert: %w", err)
	}
	return nil
}

func (r *DocumentRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Document, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, datasource_id, name, file_hash, storage_path, metadata, status, created_by_user_id, created_at, updated_at
		FROM documents
		WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	row := r.db.QueryRow(ctx, q, id, tenantID, workspaceID)

	var d model.Document
	if err := row.Scan(
		&d.ID,
		&d.TenantID,
		&d.WorkspaceID,
		&d.DatasourceID,
		&d.Name,
		&d.FileHash,
		&d.StoragePath,
		&d.Metadata,
		&d.Status,
		&d.CreatedByUserID,
		&d.CreatedAt,
		&d.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("DocumentRepository.GetByID: %w", err)
	}
	return &d, nil
}

func (r *DocumentRepository) GetByDatasourceID(ctx context.Context, datasourceID, tenantID, workspaceID uuid.UUID) ([]*model.Document, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, datasource_id, name, file_hash, storage_path, metadata, status, created_by_user_id, created_at, updated_at
		FROM documents
		WHERE datasource_id = $1 AND tenant_id = $2 AND workspace_id = $3
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, datasourceID, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("DocumentRepository.GetByDatasourceID: %w", err)
	}
	defer rows.Close()

	var docs []*model.Document
	for rows.Next() {
		var d model.Document
		if err := rows.Scan(
			&d.ID,
			&d.TenantID,
			&d.WorkspaceID,
			&d.DatasourceID,
			&d.Name,
			&d.FileHash,
			&d.StoragePath,
			&d.Metadata,
			&d.Status,
			&d.CreatedByUserID,
			&d.CreatedAt,
			&d.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("DocumentRepository.GetByDatasourceID scan: %w", err)
		}
		docs = append(docs, &d)
	}
	return docs, rows.Err()
}

func (r *DocumentRepository) Update(ctx context.Context, d *model.Document) error {
	const q = `
		UPDATE documents
		SET storage_path = $1, metadata = $2, updated_at = $3
		WHERE id = $4 AND tenant_id = $5 AND workspace_id = $6`

	_, err := r.db.Exec(ctx, q,
		d.StoragePath,
		d.Metadata,
		d.UpdatedAt,
		d.ID,
		d.TenantID,
		d.WorkspaceID,
	)
	if err != nil {
		return fmt.Errorf("DocumentRepository.Update: %w", err)
	}
	return nil
}

func (r *DocumentRepository) FindByHash(ctx context.Context, datasourceID, tenantID, workspaceID uuid.UUID, fileHash string) (*model.Document, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, datasource_id, name, file_hash, storage_path, metadata, status, created_by_user_id, created_at, updated_at
		FROM documents
		WHERE datasource_id = $1 AND file_hash = $2 AND tenant_id = $3 AND workspace_id = $4
		LIMIT 1`

	row := r.db.QueryRow(ctx, q, datasourceID, fileHash, tenantID, workspaceID)

	var d model.Document
	if err := row.Scan(
		&d.ID,
		&d.TenantID,
		&d.WorkspaceID,
		&d.DatasourceID,
		&d.Name,
		&d.FileHash,
		&d.StoragePath,
		&d.Metadata,
		&d.Status,
		&d.CreatedByUserID,
		&d.CreatedAt,
		&d.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *DocumentRepository) Delete(ctx context.Context, id, tenantID, workspaceID uuid.UUID) error {
	const q = `DELETE FROM documents WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	_, err := r.db.Exec(ctx, q, id, tenantID, workspaceID)
	if err != nil {
		return fmt.Errorf("DocumentRepository.Delete: %w", err)
	}
	return nil
}
