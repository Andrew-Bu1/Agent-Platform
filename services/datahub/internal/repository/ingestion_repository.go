package repository

import (
	"context"
	"fmt"

	"services/datahub/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IngestionRepository struct {
	db *pgxpool.Pool
}

func NewIngestionRepository(db *pgxpool.Pool) *IngestionRepository {
	return &IngestionRepository{db: db}
}

func (r *IngestionRepository) Insert(ctx context.Context, i *model.Ingestion) error {
	const q = `
		INSERT INTO ingestions (id, tenant_id, workspace_id, document_id, mode, chunk_strategy, chunk_config, embedding_model, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	_, err := r.db.Exec(ctx, q,
		i.ID,
		i.TenantID,
		i.WorkspaceID,
		i.DocumentID,
		i.Mode,
		i.ChunkStrategy,
		i.ChunkConfig,
		i.EmbeddingModel,
		i.Status,
		i.CreatedAt,
		i.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("IngestionRepository.Insert: %w", err)
	}
	return nil
}

func (r *IngestionRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Ingestion, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, document_id, mode, chunk_strategy, chunk_config, embedding_model, status, created_at, updated_at
		FROM ingestions
		WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	row := r.db.QueryRow(ctx, q, id, tenantID, workspaceID)

	var i model.Ingestion
	if err := row.Scan(
		&i.ID,
		&i.TenantID,
		&i.WorkspaceID,
		&i.DocumentID,
		&i.Mode,
		&i.ChunkStrategy,
		&i.ChunkConfig,
		&i.EmbeddingModel,
		&i.Status,
		&i.CreatedAt,
		&i.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("IngestionRepository.GetByID: %w", err)
	}
	return &i, nil
}

func (r *IngestionRepository) GetByDocumentID(ctx context.Context, documentID, tenantID, workspaceID uuid.UUID) ([]*model.Ingestion, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, document_id, mode, chunk_strategy, chunk_config, embedding_model, status, created_at, updated_at
		FROM ingestions
		WHERE document_id = $1 AND tenant_id = $2 AND workspace_id = $3
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, documentID, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("IngestionRepository.GetByDocumentID: %w", err)
	}
	defer rows.Close()

	var ingestions []*model.Ingestion
	for rows.Next() {
		var i model.Ingestion
		if err := rows.Scan(
			&i.ID,
			&i.TenantID,
			&i.WorkspaceID,
			&i.DocumentID,
			&i.Mode,
			&i.ChunkStrategy,
			&i.ChunkConfig,
			&i.EmbeddingModel,
			&i.Status,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("IngestionRepository.GetByDocumentID scan: %w", err)
		}
		ingestions = append(ingestions, &i)
	}
	return ingestions, rows.Err()
}

func (r *IngestionRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	const q = `UPDATE ingestions SET status = $1, updated_at = NOW() WHERE id = $2`

	_, err := r.db.Exec(ctx, q, status, id)
	if err != nil {
		return fmt.Errorf("IngestionRepository.UpdateStatus: %w", err)
	}
	return nil
}

func (r *IngestionRepository) UpdateEmbeddingModel(ctx context.Context, id uuid.UUID, embeddingModel string) error {
	const q = `UPDATE ingestions SET embedding_model = $1, updated_at = NOW() WHERE id = $2`

	_, err := r.db.Exec(ctx, q, embeddingModel, id)
	if err != nil {
		return fmt.Errorf("IngestionRepository.UpdateEmbeddingModel: %w", err)
	}
	return nil
}

func (r *IngestionRepository) Delete(ctx context.Context, id, tenantID, workspaceID uuid.UUID) error {
	const q = `DELETE FROM ingestions WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	_, err := r.db.Exec(ctx, q, id, tenantID, workspaceID)
	if err != nil {
		return fmt.Errorf("IngestionRepository.Delete: %w", err)
	}
	return nil
}
