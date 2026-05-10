package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AgentRepository reads agent definitions from the agents table.
type AgentRepository struct {
	pool *pgxpool.Pool
}

func NewAgentRepository(pool *pgxpool.Pool) *AgentRepository {
	return &AgentRepository{pool: pool}
}

// GetByID fetches an agent record. Definition is in definition_json.
// The full agent config (model_id, system_prompt, tool_ids, etc.)
// is stored inside definition_json.
func (r *AgentRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Agent, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, name, definition_json, created_at
		FROM agents
		WHERE id = $1
		  AND tenant_id = $2
		  AND workspace_id = $3
		  AND status != 'archived'
	`
	row := r.pool.QueryRow(ctx, q, id, tenantID, workspaceID)

	var a model.Agent
	var defJSON []byte
	if err := row.Scan(&a.ID, &a.TenantID, &a.WorkspaceID, &a.Name, &defJSON, &a.CreatedAt); err != nil {
		return nil, fmt.Errorf("GetByID agent %s: %w", id, err)
	}

	// Unmarshal definition_json into agent fields.
	var def struct {
		ModelID      string          `json:"model_id"`
		SystemPrompt string          `json:"system_prompt"`
		Config       json.RawMessage `json:"config"`
		ToolIDs      []uuid.UUID     `json:"tool_ids"`
	}
	if len(defJSON) > 0 {
		_ = json.Unmarshal(defJSON, &def)
	}
	a.ModelID = def.ModelID
	a.SystemPrompt = def.SystemPrompt
	a.Config = def.Config
	a.ToolIDs = def.ToolIDs

	return &a, nil
}
