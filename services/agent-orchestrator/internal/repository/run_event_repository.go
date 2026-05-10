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

type RunEventRepository struct {
	db *pgxpool.Pool
}

func NewRunEventRepository(db *pgxpool.Pool) *RunEventRepository {
	return &RunEventRepository{db: db}
}

func (r *RunEventRepository) Insert(ctx context.Context, runID uuid.UUID, nodeRunID *uuid.UUID, tenantID, workspaceID uuid.UUID, eventType string, payload json.RawMessage) error {
	const q = `
		INSERT INTO run_events (id, tenant_id, workspace_id, run_id, node_run_id, event_type, payload_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err := r.db.Exec(ctx, q,
		uuid.New(), tenantID, workspaceID, runID, nodeRunID, eventType, payload,
	)
	if err != nil {
		return fmt.Errorf("RunEventRepository.Insert: %w", err)
	}
	return nil
}

// ListFromSeq returns run_events with sequence_no > fromSeq, ordered ascending.
// Used to replay historical events for the SSE reconnect path.
func (r *RunEventRepository) ListFromSeq(ctx context.Context, runID, tenantID, workspaceID uuid.UUID, fromSeq int64, limit int) ([]model.RunEvent, error) {
	const q = `
		SELECT sequence_no, event_type, payload_json, created_at
		FROM run_events
		WHERE run_id = $1 AND tenant_id = $2 AND workspace_id = $3
		  AND sequence_no > $4
		ORDER BY sequence_no ASC
		LIMIT $5`

	rows, err := r.db.Query(ctx, q, runID, tenantID, workspaceID, fromSeq, limit)
	if err != nil {
		return nil, fmt.Errorf("RunEventRepository.ListFromSeq: %w", err)
	}
	defer rows.Close()

	var events []model.RunEvent
	for rows.Next() {
		var ev model.RunEvent
		var createdAt time.Time
		if err := rows.Scan(&ev.SequenceNo, &ev.EventType, &ev.PayloadJSON, &createdAt); err != nil {
			return nil, fmt.Errorf("RunEventRepository.ListFromSeq scan: %w", err)
		}
		ev.CreatedAt = createdAt
		events = append(events, ev)
	}
	return events, rows.Err()
}
