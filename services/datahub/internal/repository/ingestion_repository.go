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
		INSERT INTO ingestion (id, document_id, chunk_strategy, embedding_model, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err := r.db.Exec(ctx, q,
		i.ID,
		i.DocumentID,
		i.ChunkStrategy,
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

func (r *IngestionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Ingestion, error) {
	const q = `
		SELECT id, document_id, chunk_strategy, embedding_model, status, created_at, updated_at
		FROM ingestion
		WHERE id = $1`

	row := r.db.QueryRow(ctx, q, id)

	var i model.Ingestion
	if err := row.Scan(
		&i.ID,
		&i.DocumentID,
		&i.ChunkStrategy,
		&i.EmbeddingModel,
		&i.Status,
		&i.CreatedAt,
		&i.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("IngestionRepository.GetByID: %w", err)
	}
	return &i, nil
}

func (r *IngestionRepository) GetByDocumentID(ctx context.Context, documentID uuid.UUID) ([]*model.Ingestion, error) {
	const q = `
		SELECT id, document_id, chunk_strategy, embedding_model, status, created_at, updated_at
		FROM ingestion
		WHERE document_id = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, documentID)
	if err != nil {
		return nil, fmt.Errorf("IngestionRepository.GetByDocumentID: %w", err)
	}
	defer rows.Close()

	var ingestions []*model.Ingestion
	for rows.Next() {
		var i model.Ingestion
		if err := rows.Scan(
			&i.ID,
			&i.DocumentID,
			&i.ChunkStrategy,
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
	const q = `UPDATE ingestion SET status = $1 WHERE id = $2`

	_, err := r.db.Exec(ctx, q, status, id)
	if err != nil {
		return fmt.Errorf("IngestionRepository.UpdateStatus: %w", err)
	}
	return nil
}

func (r *IngestionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const q = `DELETE FROM ingestion WHERE id = $1`

	_, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("IngestionRepository.Delete: %w", err)
	}
	return nil
}
