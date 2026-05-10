package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"services/datahub/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUnsupportedDimension = errors.New("unsupported vector dimension")

// embeddingDimTable maps vector dimension → postgres table name (must match data-worker).
var embeddingDimTable = map[int]string{
	384:  "chunk_384dimension",
	768:  "chunk_768dimension",
	1024: "chunk_1024dimension",
}

type SearchRepository struct {
	db *pgxpool.Pool
}

func NewSearchRepository(db *pgxpool.Pool) *SearchRepository {
	return &SearchRepository{db: db}
}

// SearchByVector performs a cosine-similarity nearest-neighbour search in the
// appropriate dimension table and returns the top-k matching chunks.
func (r *SearchRepository) SearchByVector(
	ctx context.Context,
	datasourceID, tenantID, workspaceID uuid.UUID,
	vector []float64,
	topK int,
) ([]*model.VectorSearchResult, error) {
	table, ok := embeddingDimTable[len(vector)]
	if !ok {
		return nil, fmt.Errorf("%w: %d", ErrUnsupportedDimension, len(vector))
	}

	// Build pgvector literal: '[0.1,0.2,...]'
	sb := strings.Builder{}
	sb.WriteByte('[')
	for i, v := range vector {
		if i > 0 {
			sb.WriteByte(',')
		}
		fmt.Fprintf(&sb, "%g", v)
	}
	sb.WriteByte(']')
	vecLiteral := sb.String()

	q := fmt.Sprintf(`
		SELECT e.chunk_id, c.content, 1 - (e.embedding <=> $1::vector) AS score
		FROM %s e
		JOIN chunks c ON c.id = e.chunk_id
		WHERE e.datasource_id = $2
		  AND e.tenant_id = $3
		  AND e.workspace_id = $4
		ORDER BY e.embedding <=> $1::vector
		LIMIT $5`, table)

	rows, err := r.db.Query(ctx, q, vecLiteral, datasourceID, tenantID, workspaceID, topK)
	if err != nil {
		return nil, fmt.Errorf("SearchRepository.SearchByVector: %w", err)
	}
	defer rows.Close()

	var results []*model.VectorSearchResult
	for rows.Next() {
		var res model.VectorSearchResult
		if err := rows.Scan(&res.ChunkID, &res.Content, &res.Score); err != nil {
			return nil, fmt.Errorf("SearchRepository.SearchByVector scan: %w", err)
		}
		results = append(results, &res)
	}
	return results, rows.Err()
}
