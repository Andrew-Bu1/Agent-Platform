package model

import (
	"encoding/json"

	"github.com/google/uuid"
)

// NodeJob is published by the orchestrator → consumed by agent-worker.
type NodeJob struct {
	RunID       uuid.UUID       `json:"run_id"`
	NodeRunID   uuid.UUID       `json:"node_run_id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	ThreadID    *uuid.UUID      `json:"thread_id,omitempty"`
	NodeID      string          `json:"node_id"`
	NodeType    string          `json:"node_type"`
	NodeName    string          `json:"node_name"`
	NodeConfig  json.RawMessage `json:"node_config"`
	InputJSON   json.RawMessage `json:"input_json"`
}

// NodeResult is published by agent-worker → consumed by orchestrator.
type NodeResult struct {
	RunID      uuid.UUID       `json:"run_id"`
	NodeRunID  uuid.UUID       `json:"node_run_id"`
	NodeID     string          `json:"node_id"`
	Status     string          `json:"status"` // completed, failed
	OutputJSON json.RawMessage `json:"output_json,omitempty"`
	ErrorMsg   string          `json:"error_msg,omitempty"`
	// Events are fine-grained run_events rows emitted by the worker.
	Events []WorkerEvent `json:"events,omitempty"`
}

// WorkerEvent is a single run_event emitted by the agent-worker during execution.
type WorkerEvent struct {
	EventType   string          `json:"event_type"`
	PayloadJSON json.RawMessage `json:"payload_json"`
}

// DLQEntry is the dead-letter payload for failed jobs.
type DLQEntry struct {
	Queue   string `json:"queue"`
	Payload string `json:"payload"`
	Error   string `json:"error"`
}
