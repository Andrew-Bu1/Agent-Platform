package repository

import (
	"context"
	"fmt"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ToolRepository struct {
	pool *pgxpool.Pool
}

func NewToolRepository(pool *pgxpool.Pool) *ToolRepository {
	return &ToolRepository{pool: pool}
}

// GetByID fetches a single tool.
func (r *ToolRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Tool, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, name, description, tool_type,
		       config_json, input_schema, output_schema, created_at
		FROM tools
		WHERE id = $1
		  AND tenant_id = $2
		  AND workspace_id = $3
		  AND status = 'active'
	`
	row := r.pool.QueryRow(ctx, q, id, tenantID, workspaceID)

	var t model.Tool
	if err := row.Scan(
		&t.ID, &t.TenantID, &t.WorkspaceID,
		&t.Name, &t.Description, &t.ToolType,
		&t.ConfigJSON, &t.SchemaJSON, &t.OutputSchemaJSON, &t.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("GetByID tool %s: %w", id, err)
	}
	return &t, nil
}

// GetByIDs fetches multiple tools in a single query.
func (r *ToolRepository) GetByIDs(ctx context.Context, ids []uuid.UUID, tenantID, workspaceID uuid.UUID) ([]*model.Tool, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	const q = `
		SELECT id, tenant_id, workspace_id, name, description, tool_type,
		       config_json, input_schema, output_schema, created_at
		FROM tools
		WHERE id = ANY($1)
		  AND tenant_id = $2
		  AND workspace_id = $3
		  AND status = 'active'
	`
	rows, err := r.pool.Query(ctx, q, ids, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("GetByIDs tools: %w", err)
	}
	defer rows.Close()

	var tools []*model.Tool
	for rows.Next() {
		var t model.Tool
		if err := rows.Scan(
			&t.ID, &t.TenantID, &t.WorkspaceID,
			&t.Name, &t.Description, &t.ToolType,
			&t.ConfigJSON, &t.SchemaJSON, &t.OutputSchemaJSON, &t.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan tool: %w", err)
		}
		tools = append(tools, &t)
	}
	return tools, nil
}
