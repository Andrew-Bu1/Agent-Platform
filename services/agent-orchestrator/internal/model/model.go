package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Graph structures (deserialised from flow_versions.graph_json)
// ---------------------------------------------------------------------------

type Graph struct {
	EntryNodeID string      `json:"entry_node_id"`
	Nodes       []GraphNode `json:"nodes"`
	Edges       []GraphEdge `json:"edges"`
}

type GraphNode struct {
	ID     string          `json:"id"`
	Type   string          `json:"type"` // start, end, agent, agent_team, if_else, router, parallel, aggregator, human_review
	Name   string          `json:"name"`
	Config json.RawMessage `json:"config"`
}

type GraphEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	// Label is used for if_else/router branch keys (e.g. "true", "false", "default")
	Label string `json:"label,omitempty"`
}

// NodeConfig is the typed config for agent/agent_team nodes.
type NodeAgentConfig struct {
	AgentID       uuid.UUID       `json:"agent_id"`
	AgentSnapshot json.RawMessage `json:"agent_snapshot,omitempty"`
}

// NodeIfElseConfig holds the expression to evaluate for an if_else node.
// Expression is a simple Go-template-style reference: "{{.output.field}} == value"
type NodeIfElseConfig struct {
	Expression string `json:"expression"`
}

// ---------------------------------------------------------------------------
// Run state (stored in runs.state_json)
// ---------------------------------------------------------------------------

type RunState struct {
	CompletedNodes  map[string]bool            `json:"completed_nodes"`
	PendingNodes    map[string]bool            `json:"pending_nodes"`
	ParallelWaiting map[string]int             `json:"parallel_waiting,omitempty"`
	NodeOutputs     map[string]json.RawMessage `json:"node_outputs,omitempty"`
	// NodeIterations tracks how many times each node has been dispatched (loop detection).
	NodeIterations map[string]int  `json:"node_iterations,omitempty"`
	HumanWait      *HumanWaitState `json:"human_wait,omitempty"`
}

func NewRunState() *RunState {
	return &RunState{
		CompletedNodes:  make(map[string]bool),
		PendingNodes:    make(map[string]bool),
		ParallelWaiting: make(map[string]int),
		NodeOutputs:     make(map[string]json.RawMessage),
		NodeIterations:  make(map[string]int),
	}
}

// ---------------------------------------------------------------------------
// SSE / streaming
// ---------------------------------------------------------------------------

// SSEEvent is the envelope published to the Redis Pub/Sub channel and forwarded to clients.
type SSEEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// HumanWaitState records the paused node when a run is waiting_for_human.
type HumanWaitState struct {
	NodeID    string    `json:"node_id"`
	NodeRunID uuid.UUID `json:"node_run_id"`
	TaskID    uuid.UUID `json:"task_id"`
}

// RunEvent is a row from the run_events table, used for the reconnect/replay path.
type RunEvent struct {
	SequenceNo  int64           `json:"sequence_no"`
	EventType   string          `json:"event_type"`
	PayloadJSON json.RawMessage `json:"payload_json"`
	CreatedAt   time.Time       `json:"created_at"`
}

// ---------------------------------------------------------------------------
// DB models
// ---------------------------------------------------------------------------

type Run struct {
	ID            uuid.UUID       `json:"id"`
	TenantID      uuid.UUID       `json:"tenant_id"`
	WorkspaceID   uuid.UUID       `json:"workspace_id"`
	ThreadID      *uuid.UUID      `json:"thread_id,omitempty"`
	FlowID        *uuid.UUID      `json:"flow_id,omitempty"`
	FlowVersionID uuid.UUID       `json:"flow_version_id"`
	Status        string          `json:"status"`
	InputJSON     json.RawMessage `json:"input_json"`
	StateJSON     json.RawMessage `json:"state_json"`
	OutputJSON    json.RawMessage `json:"output_json,omitempty"`
	ErrorJSON     json.RawMessage `json:"error_json,omitempty"`
	StartedAt     *time.Time      `json:"started_at,omitempty"`
	FinishedAt    *time.Time      `json:"finished_at,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type NodeRun struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	RunID       uuid.UUID       `json:"run_id"`
	NodeID      string          `json:"node_id"`
	NodeType    string          `json:"node_type"`
	NodeName    string          `json:"node_name"`
	Status      string          `json:"status"`
	BranchKey   string          `json:"branch_key"`
	Iteration   int             `json:"iteration"`
	AttemptNo   int             `json:"attempt_no"`
	InputJSON   json.RawMessage `json:"input_json"`
	OutputJSON  json.RawMessage `json:"output_json,omitempty"`
	ErrorJSON   json.RawMessage `json:"error_json,omitempty"`
	StartedAt   *time.Time      `json:"started_at,omitempty"`
	FinishedAt  *time.Time      `json:"finished_at,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
}

type FlowVersion struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	FlowID      uuid.UUID       `json:"flow_id"`
	Version     int             `json:"version"`
	GraphJSON   json.RawMessage `json:"graph_json"`
	Status      string          `json:"status"`
}

// ---------------------------------------------------------------------------
// HTTP request / response
// ---------------------------------------------------------------------------

type CreateRunRequest struct {
	FlowVersionID uuid.UUID       `json:"flow_version_id"`
	ThreadID      *uuid.UUID      `json:"thread_id,omitempty"`
	Input         json.RawMessage `json:"input"`
}

type RunResponse struct {
	ID            uuid.UUID       `json:"id"`
	FlowVersionID uuid.UUID       `json:"flow_version_id"`
	ThreadID      *uuid.UUID      `json:"thread_id,omitempty"`
	Status        string          `json:"status"`
	InputJSON     json.RawMessage `json:"input_json"`
	OutputJSON    json.RawMessage `json:"output_json,omitempty"`
	ErrorJSON     json.RawMessage `json:"error_json,omitempty"`
	StartedAt     *time.Time      `json:"started_at,omitempty"`
	FinishedAt    *time.Time      `json:"finished_at,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}
