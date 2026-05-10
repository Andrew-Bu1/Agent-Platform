package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ThreadRepository struct {
	db *pgxpool.Pool
}

func NewThreadRepository(db *pgxpool.Pool) *ThreadRepository {
	return &ThreadRepository{db: db}
}

func (r *ThreadRepository) Insert(ctx context.Context, t *model.Thread) error {
	const q = `
		INSERT INTO threads (id, tenant_id, workspace_id, user_id, title, metadata_json, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	_, err := r.db.Exec(ctx, q,
		t.ID, t.TenantID, t.WorkspaceID, t.UserID, t.Title, t.MetadataJSON, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("ThreadRepository.Insert: %w", err)
	}
	return nil
}

func (r *ThreadRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Thread, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, user_id, title, metadata_json, created_at, updated_at
		FROM threads
		WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	row := r.db.QueryRow(ctx, q, id, tenantID, workspaceID)
	var t model.Thread
	if err := row.Scan(
		&t.ID, &t.TenantID, &t.WorkspaceID, &t.UserID, &t.Title, &t.MetadataJSON, &t.CreatedAt, &t.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("ThreadRepository.GetByID: %w", err)
	}
	return &t, nil
}

func (r *ThreadRepository) ListByWorkspace(ctx context.Context, tenantID, workspaceID uuid.UUID, limit, offset int) ([]*model.Thread, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, user_id, title, metadata_json, created_at, updated_at
		FROM threads
		WHERE tenant_id = $1 AND workspace_id = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`

	rows, err := r.db.Query(ctx, q, tenantID, workspaceID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("ThreadRepository.ListByWorkspace: %w", err)
	}
	defer rows.Close()

	var threads []*model.Thread
	for rows.Next() {
		var t model.Thread
		if err := rows.Scan(
			&t.ID, &t.TenantID, &t.WorkspaceID, &t.UserID, &t.Title, &t.MetadataJSON, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("ThreadRepository.ListByWorkspace scan: %w", err)
		}
		threads = append(threads, &t)
	}
	return threads, rows.Err()
}

func (r *ThreadRepository) ListRunsByThread(ctx context.Context, threadID, tenantID, workspaceID uuid.UUID, limit, offset int) ([]*model.Run, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, thread_id,
		       flow_id, flow_version_id, status,
		       input_json, state_json, output_json, error_json,
		       started_at, finished_at, created_at, updated_at
		FROM runs
		WHERE thread_id = $1 AND tenant_id = $2 AND workspace_id = $3
		ORDER BY created_at DESC
		LIMIT $4 OFFSET $5`

	rows, err := r.db.Query(ctx, q, threadID, tenantID, workspaceID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("ThreadRepository.ListRunsByThread: %w", err)
	}
	defer rows.Close()

	var runs []*model.Run
	for rows.Next() {
		var run model.Run
		if err := rows.Scan(
			&run.ID, &run.TenantID, &run.WorkspaceID, &run.ThreadID,
			&run.FlowID, &run.FlowVersionID, &run.Status,
			&run.InputJSON, &run.StateJSON, &run.OutputJSON, &run.ErrorJSON,
			&run.StartedAt, &run.FinishedAt, &run.CreatedAt, &run.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("ThreadRepository.ListRunsByThread scan: %w", err)
		}
		runs = append(runs, &run)
	}
	return runs, rows.Err()
}

func (r *ThreadRepository) ListPendingHumanReview(ctx context.Context, tenantID, workspaceID uuid.UUID) ([]*model.Run, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, thread_id,
		       flow_id, flow_version_id, status,
		       input_json, state_json, output_json, error_json,
		       started_at, finished_at, created_at, updated_at
		FROM runs
		WHERE tenant_id = $1 AND workspace_id = $2 AND status = 'waiting_for_human'
		ORDER BY updated_at ASC`

	rows, err := r.db.Query(ctx, q, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("ThreadRepository.ListPendingHumanReview: %w", err)
	}
	defer rows.Close()

	var runs []*model.Run
	for rows.Next() {
		var run model.Run
		if err := rows.Scan(
			&run.ID, &run.TenantID, &run.WorkspaceID, &run.ThreadID,
			&run.FlowID, &run.FlowVersionID, &run.Status,
			&run.InputJSON, &run.StateJSON, &run.OutputJSON, &run.ErrorJSON,
			&run.StartedAt, &run.FinishedAt, &run.CreatedAt, &run.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("ThreadRepository.ListPendingHumanReview scan: %w", err)
		}
		runs = append(runs, &run)
	}
	return runs, rows.Err()
}

// defaultMetadata returns an empty JSON object for nil metadata.
func defaultMetadata(b []byte) []byte {
	if len(b) == 0 {
		return []byte("{}")
	}
	return b
}

// NewThread constructs a Thread with defaults for persistence.
func NewThread(tenantID, workspaceID uuid.UUID, userID *uuid.UUID, title *string, metadata []byte) *model.Thread {
	now := time.Now()
	return &model.Thread{
		ID:           uuid.New(),
		TenantID:     tenantID,
		WorkspaceID:  workspaceID,
		UserID:       userID,
		Title:        title,
		MetadataJSON: defaultMetadata(metadata),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}
