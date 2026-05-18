package repository

import (
	"context"
	"fmt"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FlowVersionRepository struct {
	db *pgxpool.Pool
}

func NewFlowVersionRepository(db *pgxpool.Pool) *FlowVersionRepository {
	return &FlowVersionRepository{db: db}
}

func (r *FlowVersionRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.FlowVersion, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, flow_id, version, graph_json, status
		FROM flow_versions
		WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	row := r.db.QueryRow(ctx, q, id, tenantID, workspaceID)
	var fv model.FlowVersion
	if err := row.Scan(
		&fv.ID, &fv.TenantID, &fv.WorkspaceID, &fv.FlowID,
		&fv.Version, &fv.GraphJSON, &fv.Status,
	); err != nil {
		return nil, fmt.Errorf("FlowVersionRepository.GetByID: %w", err)
	}
	return &fv, nil
}

// GetByIDOnly loads a flow version by primary key without tenant/workspace scoping.
// For internal use by the dispatcher when processing queue results.
func (r *FlowVersionRepository) GetByIDOnly(ctx context.Context, id uuid.UUID) (*model.FlowVersion, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, flow_id, version, graph_json, status
		FROM flow_versions
		WHERE id = $1`

	row := r.db.QueryRow(ctx, q, id)
	var fv model.FlowVersion
	if err := row.Scan(
		&fv.ID, &fv.TenantID, &fv.WorkspaceID, &fv.FlowID,
		&fv.Version, &fv.GraphJSON, &fv.Status,
	); err != nil {
		return nil, fmt.Errorf("FlowVersionRepository.GetByIDOnly: %w", err)
	}
	return &fv, nil
}
