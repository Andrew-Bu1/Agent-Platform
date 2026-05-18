package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NodeRunRepository struct {
	db *pgxpool.Pool
}

func NewNodeRunRepository(db *pgxpool.Pool) *NodeRunRepository {
	return &NodeRunRepository{db: db}
}

func (r *NodeRunRepository) Insert(ctx context.Context, nr *model.NodeRun) error {
	const q = `
		INSERT INTO node_runs (
			id, tenant_id, workspace_id, run_id,
			node_id, node_type, node_name, status,
			branch_key, iteration, attempt_no,
			input_json, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`

	_, err := r.db.Exec(ctx, q,
		nr.ID, nr.TenantID, nr.WorkspaceID, nr.RunID,
		nr.NodeID, nr.NodeType, nr.NodeName, nr.Status,
		nr.BranchKey, nr.Iteration, nr.AttemptNo,
		nr.InputJSON, nr.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("NodeRunRepository.Insert: %w", err)
	}
	return nil
}

func (r *NodeRunRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, finishedAt *time.Time) error {
	const q = `UPDATE node_runs SET status = $2, finished_at = $3 WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, status, finishedAt)
	if err != nil {
		return fmt.Errorf("NodeRunRepository.UpdateStatus: %w", err)
	}
	return nil
}

func (r *NodeRunRepository) UpdateOutput(ctx context.Context, id uuid.UUID, status string, output []byte, finishedAt time.Time) error {
	const q = `UPDATE node_runs SET status = $2, output_json = $3, finished_at = $4 WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, status, output, finishedAt)
	if err != nil {
		return fmt.Errorf("NodeRunRepository.UpdateOutput: %w", err)
	}
	return nil
}

func (r *NodeRunRepository) UpdateError(ctx context.Context, id uuid.UUID, errJSON []byte, finishedAt time.Time) error {
	const q = `UPDATE node_runs SET status = 'failed', error_json = $2, finished_at = $3 WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, errJSON, finishedAt)
	if err != nil {
		return fmt.Errorf("NodeRunRepository.UpdateError: %w", err)
	}
	return nil
}

func (r *NodeRunRepository) SetStarted(ctx context.Context, id uuid.UUID, startedAt time.Time) error {
	const q = `UPDATE node_runs SET status = 'running', started_at = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, startedAt)
	return err
}

func (r *NodeRunRepository) ListByRun(ctx context.Context, runID, tenantID, workspaceID uuid.UUID) ([]model.NodeRun, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, run_id,
		       node_id, node_type, node_name, status,
		       branch_key, iteration, attempt_no,
		       input_json, output_json, error_json,
		       started_at, finished_at, created_at
		FROM node_runs
		WHERE run_id = $1 AND tenant_id = $2 AND workspace_id = $3
		ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, q, runID, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("NodeRunRepository.ListByRun: %w", err)
	}
	defer rows.Close()

	var items []model.NodeRun
	for rows.Next() {
		var nr model.NodeRun
		if err := rows.Scan(
			&nr.ID, &nr.TenantID, &nr.WorkspaceID, &nr.RunID,
			&nr.NodeID, &nr.NodeType, &nr.NodeName, &nr.Status,
			&nr.BranchKey, &nr.Iteration, &nr.AttemptNo,
			&nr.InputJSON, &nr.OutputJSON, &nr.ErrorJSON,
			&nr.StartedAt, &nr.FinishedAt, &nr.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("NodeRunRepository.ListByRun scan: %w", err)
		}
		items = append(items, nr)
	}
	return items, rows.Err()
}
