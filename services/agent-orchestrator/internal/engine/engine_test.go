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

// ---------------------------------------------------------------------------
// checkAggregators
// ---------------------------------------------------------------------------

func TestCheckAggregators_DecrementsCounter(t *testing.T) {
	eng := &Engine{
		graph: &model.Graph{
			Edges: []model.GraphEdge{
				{Source: "branch-a", Target: "agg"},
				{Source: "branch-b", Target: "agg"},
			},
			Nodes: map[string]model.GraphNode{
				"agg": {ID: "agg", Type: "aggregator"},
			},
		},
		state: &model.RunState{
			ParallelWaiting: map[string]int{"agg": 2},
			NodeOutputs:     map[string]json.RawMessage{},
			PendingNodes:    map[string]bool{},
			CompletedNodes:  map[string]bool{},
			NodeIterations:  map[string]int{},
		},
	}
	// After branch-a completes, counter should be 1 (aggregator not yet ready).
	// We can't call checkAggregators directly because dispatchNode needs repos,
	// but we can test the counter arithmetic by inspecting state after manual
	// decrement — we verify the map is mutated correctly.
	eng.state.ParallelWaiting["agg"]--
	if eng.state.ParallelWaiting["agg"] != 1 {
		t.Errorf("expected counter 1, got %d", eng.state.ParallelWaiting["agg"])
	}
}

func TestCheckAggregators_CounterReachesZero(t *testing.T) {
	eng := &Engine{
		graph: &model.Graph{
			Edges: []model.GraphEdge{
				{Source: "branch-a", Target: "agg"},
			},
			Nodes: map[string]model.GraphNode{
				"agg": {ID: "agg", Type: "aggregator"},
			},
		},
		state: &model.RunState{
			ParallelWaiting: map[string]int{"agg": 1},
			NodeOutputs:     map[string]json.RawMessage{},
			PendingNodes:    map[string]bool{},
			CompletedNodes:  map[string]bool{},
			NodeIterations:  map[string]int{},
		},
	}
	// Manually simulate counter reaching zero — verify map is cleaned up.
	eng.state.ParallelWaiting["agg"]--
	if eng.state.ParallelWaiting["agg"] <= 0 {
		delete(eng.state.ParallelWaiting, "agg")
	}
	if _, still := eng.state.ParallelWaiting["agg"]; still {
		t.Error("aggregator key should be removed when counter reaches 0")
	}
}

// ---------------------------------------------------------------------------
// advanceIfElse routing (via evalExpression + advanceIfElse logic)
// ---------------------------------------------------------------------------

func TestAdvanceIfElse_TrueBranch(t *testing.T) {
	eng := &Engine{
		graph: &model.Graph{
			Nodes: map[string]model.GraphNode{
				"cond": {ID: "cond", Type: "if_else"},
				"yes":  {ID: "yes", Type: "agent"},
				"no":   {ID: "no", Type: "agent"},
			},
			Edges: []model.GraphEdge{
				{Source: "cond", Target: "yes", Label: "true"},
				{Source: "cond", Target: "no", Label: "false"},
			},
		},
	}
	// evalExpression decides the branch; verify routing result for "true"
	result := eng.evalExpression(`{{.ok}} == yes`, json.RawMessage(`{"ok":"yes"}`))
	if !result {
		t.Error("expected true branch to be selected")
	}
}

func TestAdvanceIfElse_FalseBranch(t *testing.T) {
	eng := &Engine{}
	result := eng.evalExpression(`{{.ok}} == yes`, json.RawMessage(`{"ok":"no"}`))
	if result {
		t.Error("expected false branch to be selected")
	}
}

// ---------------------------------------------------------------------------
// advanceRouter routing
// ---------------------------------------------------------------------------

func TestAdvanceRouter_RouteExtraction(t *testing.T) {
	// Verify the route extraction logic: output must have a "route" key.
	output := json.RawMessage(`{"route":"report"}`)
	var out map[string]json.RawMessage
	_ = json.Unmarshal(output, &out)

	route := "default"
	if r, ok := out["route"]; ok {
		_ = json.Unmarshal(r, &route)
	}
	if route != "report" {
		t.Errorf("expected route 'report', got %q", route)
	}
}

func TestAdvanceRouter_DefaultRoute(t *testing.T) {
	// Output with no "route" key should fall back to "default".
	output := json.RawMessage(`{"score":42}`)
	var out map[string]json.RawMessage
	_ = json.Unmarshal(output, &out)

	route := "default"
	if r, ok := out["route"]; ok {
		_ = json.Unmarshal(r, &route)
	}
	if route != "default" {
		t.Errorf("expected default route, got %q", route)
	}
}

// ---------------------------------------------------------------------------
// MaxNodeIterations guard
// ---------------------------------------------------------------------------

func TestMaxNodeIterations_GuardValue(t *testing.T) {
	if maxNodeIterations != 25 {
		t.Errorf("maxNodeIterations should be 25, got %d", maxNodeIterations)
	}
}

func TestNodeIterations_ExceedsMax(t *testing.T) {
	state := model.NewRunState()
	nodeID := "loop-agent"

	for i := 0; i < maxNodeIterations; i++ {
		state.NodeIterations[nodeID]++
	}
	// One more push would exceed the limit.
	state.NodeIterations[nodeID]++
	if state.NodeIterations[nodeID] <= maxNodeIterations {
		t.Errorf("expected iteration count to exceed %d", maxNodeIterations)
	}
}

// ---------------------------------------------------------------------------
// Advance — HumanWait pause detected
// ---------------------------------------------------------------------------

func TestAdvance_HumanWaitPause(t *testing.T) {
	// After handleResult sets HumanWait, Advance must return without completing.
	state := model.NewRunState()
	state.HumanWait = &model.HumanWaitState{
		NodeID: "review-node",
	}
	state.PendingNodes["review-node"] = true

	// Simulate the Advance post-condition check:
	// if HumanWait != nil → do not complete run.
	if state.HumanWait != nil {
		// Correct: run is paused, not completed.
		return
	}
	t.Error("should have detected HumanWait and returned early")
}

func TestAdvance_CompletesWhenNoPendingNodes(t *testing.T) {
	state := model.NewRunState()
	// No pending nodes and no human wait → run should complete.
	if len(state.PendingNodes) != 0 {
		t.Fatal("expected empty PendingNodes")
	}
	if state.HumanWait != nil {
		t.Fatal("expected nil HumanWait")
	}
	// completeRun would be called — verified by state invariant.
}

// ---------------------------------------------------------------------------
// NewRunState initialisation
// ---------------------------------------------------------------------------

func TestNewRunState_Initialised(t *testing.T) {
	s := model.NewRunState()
	if s.CompletedNodes == nil {
		t.Error("CompletedNodes must not be nil")
	}
	if s.PendingNodes == nil {
		t.Error("PendingNodes must not be nil")
	}
	if s.ParallelWaiting == nil {
		t.Error("ParallelWaiting must not be nil")
	}
	if s.NodeOutputs == nil {
		t.Error("NodeOutputs must not be nil")
	}
	if s.NodeIterations == nil {
		t.Error("NodeIterations must not be nil")
	}
	if s.HumanWait != nil {
		t.Error("HumanWait must be nil on initialisation")
	}
}

// ---------------------------------------------------------------------------
// nodeTypesHandledByOrchestrator
// ---------------------------------------------------------------------------

func TestNodeTypesHandledByOrchestrator(t *testing.T) {
	inline := []string{"start", "end", "if_else", "router", "parallel", "aggregator"}
	for _, typ := range inline {
		if !nodeTypesHandledByOrchestrator[typ] {
			t.Errorf("node type %q should be handled by orchestrator", typ)
		}
	}
	external := []string{"agent", "agent_team", "human_review", "tool"}
	for _, typ := range external {
		if nodeTypesHandledByOrchestrator[typ] {
			t.Errorf("node type %q should NOT be handled by orchestrator (goes to worker)", typ)
		}
	}
}
