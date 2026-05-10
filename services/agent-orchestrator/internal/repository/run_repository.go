package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RunRepository struct {
	db *pgxpool.Pool
}

func NewRunRepository(db *pgxpool.Pool) *RunRepository {
	return &RunRepository{db: db}
}

func (r *RunRepository) Insert(ctx context.Context, run *model.Run) error {
	const q = `
		INSERT INTO runs (
			id, tenant_id, workspace_id, thread_id,
			flow_id, flow_version_id, status,
			input_json, state_json,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`

	_, err := r.db.Exec(ctx, q,
		run.ID, run.TenantID, run.WorkspaceID, run.ThreadID,
		run.FlowID, run.FlowVersionID, run.Status,
		run.InputJSON, run.StateJSON,
		run.CreatedAt, run.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("RunRepository.Insert: %w", err)
	}
	return nil
}

func (r *RunRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Run, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, thread_id,
		       flow_id, flow_version_id, status,
		       input_json, state_json, output_json, error_json,
		       started_at, finished_at, created_at, updated_at
		FROM runs
		WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	row := r.db.QueryRow(ctx, q, id, tenantID, workspaceID)
	var run model.Run
	if err := row.Scan(
		&run.ID, &run.TenantID, &run.WorkspaceID, &run.ThreadID,
		&run.FlowID, &run.FlowVersionID, &run.Status,
		&run.InputJSON, &run.StateJSON, &run.OutputJSON, &run.ErrorJSON,
		&run.StartedAt, &run.FinishedAt, &run.CreatedAt, &run.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("RunRepository.GetByID: %w", err)
	}
	return &run, nil
}

func (r *RunRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, finishedAt *time.Time) error {
	const q = `
		UPDATE runs SET status = $2, finished_at = $3, updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, status, finishedAt)
	if err != nil {
		return fmt.Errorf("RunRepository.UpdateStatus: %w", err)
	}
	return nil
}

func (r *RunRepository) UpdateState(ctx context.Context, id uuid.UUID, state *model.RunState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("RunRepository.UpdateState marshal: %w", err)
	}
	const q = `UPDATE runs SET state_json = $2, updated_at = NOW() WHERE id = $1`
	_, err = r.db.Exec(ctx, q, id, data)
	if err != nil {
		return fmt.Errorf("RunRepository.UpdateState: %w", err)
	}
	return nil
}

func (r *RunRepository) UpdateOutput(ctx context.Context, id uuid.UUID, status string, output json.RawMessage, finishedAt time.Time) error {
	const q = `
		UPDATE runs SET status = $2, output_json = $3, finished_at = $4, updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, status, output, finishedAt)
	if err != nil {
		return fmt.Errorf("RunRepository.UpdateOutput: %w", err)
	}
	return nil
}

func (r *RunRepository) UpdateError(ctx context.Context, id uuid.UUID, errMsg string, finishedAt time.Time) error {
	errJSON := []byte(`{"message":` + `"` + errMsg + `"` + `}`)
	const q = `
		UPDATE runs SET status = 'failed', error_json = $2, finished_at = $3, updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, errJSON, finishedAt)
	if err != nil {
		return fmt.Errorf("RunRepository.UpdateError: %w", err)
	}
	return nil
}

func (r *RunRepository) SetStarted(ctx context.Context, id uuid.UUID, startedAt time.Time) error {
	const q = `UPDATE runs SET status = 'running', started_at = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, startedAt)
	return err
}
