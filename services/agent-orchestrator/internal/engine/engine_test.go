package engine

import (
	"encoding/json"
	"testing"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
)

// evalExpression uses no Engine fields — a zero-value Engine is sufficient.
var e = &Engine{}

func TestEvalExpression_EmptyReturnsTrue(t *testing.T) {
	if !e.evalExpression("", json.RawMessage(`{}`)) {
		t.Error("empty expression should return true")
	}
}

func TestEvalExpression_Equals(t *testing.T) {
	tests := []struct {
		name   string
		expr   string
		output string
		want   bool
	}{
		{"match", `{{.status}} == completed`, `{"status":"completed"}`, true},
		{"no match", `{{.status}} == completed`, `{"status":"failed"}`, false},
		{"quoted value", `{{.route}} == "report"`, `{"route":"report"}`, true},
		{"numeric as string", `{{.score}} == 42`, `{"score":42}`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := e.evalExpression(tt.expr, json.RawMessage(tt.output))
			if got != tt.want {
				t.Errorf("evalExpression(%q) = %v, want %v", tt.expr, got, tt.want)
			}
		})
	}
}

func TestEvalExpression_NotEquals(t *testing.T) {
	tests := []struct {
		name   string
		expr   string
		output string
		want   bool
	}{
		{"different values", `{{.status}} != failed`, `{"status":"completed"}`, true},
		{"same values", `{{.status}} != failed`, `{"status":"failed"}`, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := e.evalExpression(tt.expr, json.RawMessage(tt.output))
			if got != tt.want {
				t.Errorf("evalExpression(%q) = %v, want %v", tt.expr, got, tt.want)
			}
		})
	}
}

func TestEvalExpression_EdgeCases(t *testing.T) {
	// Missing field → false
	if e.evalExpression(`{{.missing}} == value`, json.RawMessage(`{}`)) {
		t.Error("missing field should return false")
	}
	// Invalid JSON → false
	if e.evalExpression(`{{.x}} == 1`, json.RawMessage(`not-json`)) {
		t.Error("invalid json should return false")
	}
	// No operator → false
	if e.evalExpression(`{{.status}}`, json.RawMessage(`{"status":"done"}`)) {
		t.Error("expression without operator should return false")
	}
}

func TestNodeByID(t *testing.T) {
	eng := &Engine{
		graph: &model.Graph{
			Nodes: map[string]model.GraphNode{
				"start": {ID: "start", Type: "start", Label: "Start"},
				"end":   {ID: "end", Type: "end", Label: "End"},
			},
		},
	}
	if n := eng.nodeByID("start"); n == nil || n.Type != "start" {
		t.Error("expected to find start node")
	}
	if n := eng.nodeByID("missing"); n != nil {
		t.Error("expected nil for missing node")
	}
}

func TestOutgoingEdges(t *testing.T) {
	eng := &Engine{
		graph: &model.Graph{
			Edges: []model.GraphEdge{
				{ID: "e1", Source: "start", Target: "agent-1"},
				{ID: "e2", Source: "agent-1", Target: "end"},
				{ID: "e3", Source: "router", Target: "team-a", Label: "report"},
				{ID: "e4", Source: "router", Target: "team-b", Label: "analysis"},
			},
		},
	}

	startEdges := eng.outgoingEdges("start")
	if len(startEdges) != 1 || startEdges[0].Target != "agent-1" {
		t.Errorf("expected 1 edge from start, got %v", startEdges)
	}

	routerEdges := eng.outgoingEdges("router")
	if len(routerEdges) != 2 {
		t.Errorf("expected 2 edges from router, got %d", len(routerEdges))
	}
}

func TestIncomingEdgeCount(t *testing.T) {
	eng := &Engine{
		graph: &model.Graph{
			Edges: []model.GraphEdge{
				{Source: "branch-a", Target: "aggregator"},
				{Source: "branch-b", Target: "aggregator"},
				{Source: "start", Target: "other"},
			},
		},
	}
	if count := eng.incomingEdgeCount("aggregator"); count != 2 {
		t.Errorf("expected 2 incoming edges, got %d", count)
	}
	if count := eng.incomingEdgeCount("other"); count != 1 {
		t.Errorf("expected 1 incoming edge, got %d", count)
	}
}

func TestBuildAggregatedInput(t *testing.T) {
	out1 := json.RawMessage(`{"result":"data-a"}`)
	out2 := json.RawMessage(`{"result":"data-b"}`)

	eng := &Engine{
		graph: &model.Graph{
			Edges: []model.GraphEdge{
				{Source: "branch-a", Target: "agg"},
				{Source: "branch-b", Target: "agg"},
			},
		},
		state: &model.RunState{
			NodeOutputs: map[string]json.RawMessage{
				"branch-a": out1,
				"branch-b": out2,
			},
		},
	}

	combined := eng.buildAggregatedInput("agg")
	var m map[string]json.RawMessage
	if err := json.Unmarshal(combined, &m); err != nil {
		t.Fatalf("buildAggregatedInput returned invalid JSON: %v", err)
	}
	if _, ok := m["branch-a"]; !ok {
		t.Error("expected branch-a in combined output")
	}
	if _, ok := m["branch-b"]; !ok {
		t.Error("expected branch-b in combined output")
	}
}
