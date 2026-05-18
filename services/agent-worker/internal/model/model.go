package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// NodeJob is pushed by the orchestrator and consumed by the worker.
type NodeJob struct {
	RunID       uuid.UUID       `json:"run_id"`
	NodeRunID   uuid.UUID       `json:"node_run_id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	ThreadID    *uuid.UUID      `json:"thread_id,omitempty"`
	NodeID      string          `json:"node_id"`
	NodeType    string          `json:"node_type"`
	NodeName    string          `json:"node_name"`
	NodeConfig  json.RawMessage `json:"node_config,omitempty"`
	InputJSON   json.RawMessage `json:"input"`
}

// NodeResult is pushed by the worker and consumed by the orchestrator.
type NodeResult struct {
	RunID       uuid.UUID       `json:"run_id"`
	NodeRunID   uuid.UUID       `json:"node_run_id"`
	NodeID      string          `json:"node_id"`
	Status      string          `json:"status"` // "completed" | "failed"
	OutputJSON  json.RawMessage `json:"output,omitempty"`
	ErrorMsg    string          `json:"error,omitempty"`
	Events      []WorkerEvent   `json:"events,omitempty"`
}

// WorkerEvent is a fine-grained event emitted by the worker during execution.
type WorkerEvent struct {
	EventType   string          `json:"event_type"`
	PayloadJSON json.RawMessage `json:"payload"`
}

// DLQEntry wraps a failed message for dead-letter processing.
type DLQEntry struct {
	Queue   string `json:"queue"`
	Payload string `json:"payload"`
	Error   string `json:"error"`
}

// Agent holds the DB record for an agent.
type Agent struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	Name        string          `json:"name"`
	ModelID     string          `json:"model_id"`
	SystemPrompt string         `json:"system_prompt"`
	Config      json.RawMessage `json:"config"`
	ToolIDs     []uuid.UUID     `json:"tool_ids"`
	CreatedAt   time.Time       `json:"created_at"`
}

// Tool holds the DB record for a tool.
type Tool struct {
	ID               uuid.UUID       `json:"id"`
	TenantID         uuid.UUID       `json:"tenant_id"`
	WorkspaceID      uuid.UUID       `json:"workspace_id"`
	Name             string          `json:"name"`
	Description      string          `json:"description"`
	ToolType         string          `json:"tool_type"` // "http", "code", etc.
	ConfigJSON       json.RawMessage `json:"config"`
	SchemaJSON       json.RawMessage `json:"schema"`        // alias for InputSchemaJSON (used by executor)
	OutputSchemaJSON json.RawMessage `json:"output_schema"`
	CreatedAt        time.Time       `json:"created_at"`
}

// Message is a row from the messages table (conversation history).
type Message struct {
	ID           uuid.UUID       `json:"id"`
	TenantID     uuid.UUID       `json:"tenant_id"`
	WorkspaceID  uuid.UUID       `json:"workspace_id"`
	ThreadID     uuid.UUID       `json:"thread_id"`
	RunID        *uuid.UUID      `json:"run_id,omitempty"`
	NodeRunID    *uuid.UUID      `json:"node_run_id,omitempty"`
	Role         string          `json:"role"` // "user" | "assistant" | "tool" | "system"
	ContentJSON  json.RawMessage `json:"content"`
	MetadataJSON json.RawMessage `json:"metadata"`
	CreatedAt    time.Time       `json:"created_at"`
}

// HumanReviewTask is inserted when a human_review node fires.
type HumanReviewTask struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	RunID       uuid.UUID       `json:"run_id"`
	NodeRunID   uuid.UUID       `json:"node_run_id"`
	ThreadID    *uuid.UUID      `json:"thread_id,omitempty"`
	Payload     json.RawMessage `json:"payload"`
	Status      string          `json:"status"` // "pending" | "approved" | "rejected"
	CreatedAt   time.Time       `json:"created_at"`
}

// NodeAgentConfig is the config blob parsed from GraphNode.Data for agent and
// agent_team nodes. JSON tags are camelCase to match CanvasNodeData serialised
// into graph_json by the frontend.
//
// agent_team uses the supervisor-handoff pattern exclusively:
//   - AgentID / entryAgentId — supervisor agent that drives the handoff loop.
//   - memberAgentIds         — pool of agents the supervisor can delegate to.
//   - exitAgentId            — agent whose output is returned to the parent flow
//                              (optional; defaults to the supervisor's last reply).
//
// Deterministic routing (sequential, parallel, loops, conditional branches) is
// expressed on the outer flow canvas via router / if_else / parallel / back-edges.
// There is no "teamType" field; agent_team always means supervisor handoff.
type NodeAgentConfig struct {
	AgentID        uuid.UUID       `json:"agentId"`
	AgentSnapshot  json.RawMessage `json:"agentSnapshot,omitempty"`
	MaxIterations  int             `json:"maxIterations"`
	TimeoutSeconds int             `json:"timeoutSeconds"`
}

// AgentConfig holds optional agent-level settings parsed from Agent.Config.
type AgentConfig struct {
	MaxIterations  int `json:"max_iterations"`
	TimeoutSeconds int `json:"timeout_seconds"`
}
