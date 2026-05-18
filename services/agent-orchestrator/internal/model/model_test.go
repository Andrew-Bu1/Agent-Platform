package model

import (
	"encoding/json"
	"testing"
)

func TestPopulateNodeIDs(t *testing.T) {
	g := &Graph{
		EntryNodeID: "start",
		Nodes: map[string]GraphNode{
			"start":     {Type: "start", Label: "Start"},
			"agent-1":   {Type: "agent", Label: "Research Agent"},
			"if-check":  {Type: "if_else", Label: "Quality Check"},
			"end":       {Type: "end", Label: "End"},
		},
	}
	g.PopulateNodeIDs()

	for key, node := range g.Nodes {
		if node.ID != key {
			t.Errorf("node %q has ID %q after PopulateNodeIDs", key, node.ID)
		}
	}
}

func TestNewRunState_Initialized(t *testing.T) {
	s := NewRunState()
	if s.CompletedNodes == nil {
		t.Error("CompletedNodes must be initialized")
	}
	if s.PendingNodes == nil {
		t.Error("PendingNodes must be initialized")
	}
	if s.ParallelWaiting == nil {
		t.Error("ParallelWaiting must be initialized")
	}
	if s.NodeOutputs == nil {
		t.Error("NodeOutputs must be initialized")
	}
	if s.NodeIterations == nil {
		t.Error("NodeIterations must be initialized")
	}
	if s.HumanWait != nil {
		t.Error("HumanWait should be nil initially")
	}
}

func TestGraphJSON_RoundTrip(t *testing.T) {
	raw := `{
		"entry_node_id": "start",
		"nodes": {
			"start":   {"type":"start",  "label":"Start"},
			"agent-1": {"type":"agent",  "label":"Worker", "data":{"agent_id":"00000000-0000-0000-0000-000000000001"}},
			"end":     {"type":"end",    "label":"End"}
		},
		"edges": [
			{"id":"e1","source":"start",   "target":"agent-1"},
			{"id":"e2","source":"agent-1", "target":"end"}
		]
	}`

	var g Graph
	if err := json.Unmarshal([]byte(raw), &g); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if g.EntryNodeID != "start" {
		t.Errorf("EntryNodeID = %q, want start", g.EntryNodeID)
	}
	if len(g.Nodes) != 3 {
		t.Errorf("expected 3 nodes, got %d", len(g.Nodes))
	}
	if len(g.Edges) != 2 {
		t.Errorf("expected 2 edges, got %d", len(g.Edges))
	}

	g.PopulateNodeIDs()
	if g.Nodes["agent-1"].ID != "agent-1" {
		t.Errorf("agent-1 node ID not populated, got %q", g.Nodes["agent-1"].ID)
	}
}

func TestGraphEdge_LabelOptional(t *testing.T) {
	noLabel := `{"id":"e1","source":"a","target":"b"}`
	withLabel := `{"id":"e2","source":"router","target":"team-a","label":"report"}`

	var e1, e2 GraphEdge
	if err := json.Unmarshal([]byte(noLabel), &e1); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(withLabel), &e2); err != nil {
		t.Fatal(err)
	}
	if e1.Label != "" {
		t.Errorf("expected empty label, got %q", e1.Label)
	}
	if e2.Label != "report" {
		t.Errorf("expected label 'report', got %q", e2.Label)
	}
}

func TestNodeIfElseConfig(t *testing.T) {
	raw := `{"expression":"{{.status}} == completed"}`
	var cfg NodeIfElseConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if cfg.Expression != "{{.status}} == completed" {
		t.Errorf("unexpected expression: %q", cfg.Expression)
	}
}
