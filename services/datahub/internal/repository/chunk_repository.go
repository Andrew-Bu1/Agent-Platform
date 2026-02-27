package repository

import (
	"context"
	"fmt"

	"services/datahub/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ChunkRepository struct {
	db *pgxpool.Pool
}

func NewChunkRepository(db *pgxpool.Pool) *ChunkRepository {
	return &ChunkRepository{db: db}
}

func (r *ChunkRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Chunk, error) {
	const q = `
		SELECT id, ingestion_id, chunk_index, content, metadata, created_at, updated_at
		FROM chunk
		WHERE id = $1`

	row := r.db.QueryRow(ctx, q, id)

	var c model.Chunk
	if err := row.Scan(
		&c.ID,
		&c.IngestionID,
		&c.ChunkIndex,
		&c.Content,
		&c.Metadata,
		&c.CreatedAt,
		&c.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("ChunkRepository.GetByID: %w", err)
	}
	return &c, nil
}

func (r *ChunkRepository) GetByIngestionID(ctx context.Context, ingestionID uuid.UUID) ([]*model.Chunk, error) {
	const q = `
		SELECT id, ingestion_id, chunk_index, content, metadata, created_at, updated_at
		FROM chunk
		WHERE ingestion_id = $1
		ORDER BY chunk_index ASC`

	rows, err := r.db.Query(ctx, q, ingestionID)
	if err != nil {
		return nil, fmt.Errorf("ChunkRepository.GetByIngestionID: %w", err)
	}
	defer rows.Close()

	var chunks []*model.Chunk
	for rows.Next() {
		var c model.Chunk
		if err := rows.Scan(
			&c.ID,
			&c.IngestionID,
			&c.ChunkIndex,
			&c.Content,
			&c.Metadata,
			&c.CreatedAt,
			&c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("ChunkRepository.GetByIngestionID scan: %w", err)
		}
		chunks = append(chunks, &c)
	}
	return chunks, rows.Err()
}

func (r *ChunkRepository) Delete(ctx context.Context, chunk *model.Chunk) error {
	const q = `DELETE FROM chunk WHERE id = $1`

	_, err := r.db.Exec(ctx, q, chunk.ID)
	if err != nil {
		return fmt.Errorf("ChunkRepository.Delete: %w", err)
	}
	return nil
}