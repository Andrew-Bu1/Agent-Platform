package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NodeRunRepository struct {
	pool *pgxpool.Pool
}

func NewNodeRunRepository(pool *pgxpool.Pool) *NodeRunRepository {
	return &NodeRunRepository{pool: pool}
}

func (r *NodeRunRepository) SetStarted(ctx context.Context, id uuid.UUID, at time.Time) error {
	const q = `UPDATE node_runs SET status='running', started_at=$2 WHERE id=$1`
	_, err := r.pool.Exec(ctx, q, id, at)
	return err
}

func (r *NodeRunRepository) UpdateOutput(ctx context.Context, id uuid.UUID, status string, output []byte, finishedAt time.Time) error {
	const q = `UPDATE node_runs SET status=$2, output_json=$3, finished_at=$4 WHERE id=$1`
	_, err := r.pool.Exec(ctx, q, id, status, output, finishedAt)
	return err
}

func (r *NodeRunRepository) UpdateError(ctx context.Context, id uuid.UUID, errJSON []byte, finishedAt time.Time) error {
	const q = `UPDATE node_runs SET status='failed', error_json=$2, finished_at=$3 WHERE id=$1`
	_, err := r.pool.Exec(ctx, q, id, errJSON, finishedAt)
	if err != nil {
		return fmt.Errorf("UpdateError node_run %s: %w", id, err)
	}
	return nil
}
