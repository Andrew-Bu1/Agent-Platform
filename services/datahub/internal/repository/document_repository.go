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
		INSERT INTO documents (id, datasource_id, name, file_hash, storage_path, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	_, err := r.db.Exec(ctx, q,
		d.ID,
		d.DatasourceID,
		d.Name,
		d.FileHash,
		d.StoragePath,
		d.Metadata,
		d.CreatedAt,
		d.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("DocumentRepository.Insert: %w", err)
	}
	return nil
}

func (r *DocumentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Document, error) {
	const q = `
		SELECT id, datasource_id, name, file_hash, storage_path, metadata, created_at, updated_at
		FROM documents
		WHERE id = $1`

	row := r.db.QueryRow(ctx, q, id)

	var d model.Document
	if err := row.Scan(
		&d.ID,
		&d.DatasourceID,
		&d.Name,
		&d.FileHash,
		&d.StoragePath,
		&d.Metadata,
		&d.CreatedAt,
		&d.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("DocumentRepository.GetByID: %w", err)
	}
	return &d, nil
}

func (r *DocumentRepository) GetByDatasourceID(ctx context.Context, datasourceID uuid.UUID) ([]*model.Document, error) {
	const q = `
		SELECT id, datasource_id, name, file_hash, storage_path, metadata, created_at, updated_at
		FROM documents
		WHERE datasource_id = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, datasourceID)
	if err != nil {
		return nil, fmt.Errorf("DocumentRepository.GetByDatasourceID: %w", err)
	}
	defer rows.Close()

	var docs []*model.Document
	for rows.Next() {
		var d model.Document
		if err := rows.Scan(
			&d.ID,
			&d.DatasourceID,
			&d.Name,
			&d.FileHash,
			&d.StoragePath,
			&d.Metadata,
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
		WHERE id = $4`

	_, err := r.db.Exec(ctx, q,
		d.StoragePath,
		d.Metadata,
		d.UpdatedAt,
		d.ID,
	)
	if err != nil {
		return fmt.Errorf("DocumentRepository.Update: %w", err)
	}
	return nil
}

func (r *DocumentRepository) FindByHash(ctx context.Context, datasourceID uuid.UUID, fileHash string) (*model.Document, error) {
	const q = `
		SELECT id, datasource_id, name, file_hash, storage_path, metadata, created_at, updated_at
		FROM documents
		WHERE datasource_id = $1 AND file_hash = $2
		LIMIT 1`

	row := r.db.QueryRow(ctx, q, datasourceID, fileHash)

	var d model.Document
	if err := row.Scan(
		&d.ID,
		&d.DatasourceID,
		&d.Name,
		&d.FileHash,
		&d.StoragePath,
		&d.Metadata,
		&d.CreatedAt,
		&d.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *DocumentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const q = `DELETE FROM documents WHERE id = $1`

	_, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("DocumentRepository.Delete: %w", err)
	}
	return nil
}
