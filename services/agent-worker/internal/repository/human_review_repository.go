package repository

import (
	"context"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HumanReviewRepository struct {
	pool *pgxpool.Pool
}

func NewHumanReviewRepository(pool *pgxpool.Pool) *HumanReviewRepository {
	return &HumanReviewRepository{pool: pool}
}

// Insert creates a new human_review_tasks row.
func (r *HumanReviewRepository) Insert(ctx context.Context, task *model.HumanReviewTask) error {
	const q = `
		INSERT INTO human_review_tasks
		  (id, tenant_id, workspace_id, run_id, node_run_id, status, snapshot_json, priority, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.pool.Exec(ctx, q,
		task.ID, task.TenantID, task.WorkspaceID,
		task.RunID, task.NodeRunID,
		task.Status,
		task.Payload, // stored in snapshot_json
		"normal",
		time.Now(),
	)
	return err
}

// Approve marks a task approved with a decision payload.
func (r *HumanReviewRepository) Approve(ctx context.Context, id uuid.UUID, decision []byte) error {
	now := time.Now()
	const q = `
		UPDATE human_review_tasks
		SET status='approved', decision_json=$2, completed_at=$3
		WHERE id=$1
	`
	_, err := r.pool.Exec(ctx, q, id, decision, now)
	return err
}
