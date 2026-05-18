package repository

import (
	"context"
	"fmt"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepository struct {
	pool *pgxpool.Pool
}

func NewMessageRepository(pool *pgxpool.Pool) *MessageRepository {
	return &MessageRepository{pool: pool}
}

// GetByThreadID returns messages for a thread, ordered by created_at ascending.
// limit <= 0 means no limit (returns all).
func (r *MessageRepository) GetByThreadID(ctx context.Context, threadID, tenantID, workspaceID uuid.UUID, limit int) ([]*model.Message, error) {
	q := `
		SELECT id, tenant_id, workspace_id, thread_id, run_id, node_run_id,
		       role, content_json, metadata_json, created_at
		FROM messages
		WHERE thread_id = $1
		  AND tenant_id = $2
		  AND workspace_id = $3
		ORDER BY created_at ASC
	`
	args := []any{threadID, tenantID, workspaceID}
	if limit > 0 {
		q += " LIMIT $4"
		args = append(args, limit)
	}

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("GetByThreadID: %w", err)
	}
	defer rows.Close()

	var msgs []*model.Message
	for rows.Next() {
		var m model.Message
		if err := rows.Scan(
			&m.ID, &m.TenantID, &m.WorkspaceID,
			&m.ThreadID, &m.RunID, &m.NodeRunID,
			&m.Role, &m.ContentJSON, &m.MetadataJSON, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}
		msgs = append(msgs, &m)
	}
	return msgs, nil
}

// Insert appends a message to the thread.
func (r *MessageRepository) Insert(ctx context.Context, m *model.Message) error {
	const q = `
		INSERT INTO messages
		  (id, tenant_id, workspace_id, thread_id, run_id, node_run_id,
		   role, content_json, metadata_json, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.pool.Exec(ctx, q,
		m.ID, m.TenantID, m.WorkspaceID,
		m.ThreadID, m.RunID, m.NodeRunID,
		m.Role, m.ContentJSON, m.MetadataJSON, m.CreatedAt,
	)
	return err
}
