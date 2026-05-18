package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/queue"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/repository"
	"github.com/google/uuid"
)

const maxNodeIterations = 25

var nodeTypesHandledByOrchestrator = map[string]bool{
	"start":      true,
	"end":        true,
	"if_else":    true,
	"router":     true,
	"parallel":   true,
	"aggregator": true,
}

// Engine drives the execution of a single run.
// It is stateless with respect to goroutines: every method call loads from
// and writes back to the database, so any orchestrator instance can handle
// any run.
type Engine struct {
	run         *model.Run
	graph       *model.Graph
	state       *model.RunState
	runRepo     *repository.RunRepository
	nodeRunRepo *repository.NodeRunRepository
	eventRepo   *repository.RunEventRepository
	q           *queue.Client
	nodeQueue   string
}

func NewEngine(
	run *model.Run,
	graph *model.Graph,
	state *model.RunState,
	runRepo *repository.RunRepository,
	nodeRunRepo *repository.NodeRunRepository,
	eventRepo *repository.RunEventRepository,
	q *queue.Client,
	nodeQueue string,
) *Engine {
	return &Engine{
		run:         run,
		graph:       graph,
		state:       state,
		runRepo:     runRepo,
		nodeRunRepo: nodeRunRepo,
		eventRepo:   eventRepo,
		q:           q,
		nodeQueue:   nodeQueue,
	}
}

// DispatchEntry marks the run as started and dispatches the entry node job.
// Called once by CreateRun; afterwards the dispatcher handles all NodeResults.
func (e *Engine) DispatchEntry(ctx context.Context) error {
	now := time.Now()
	if err := e.runRepo.SetStarted(ctx, e.run.ID, now); err != nil {
		return fmt.Errorf("set run started: %w", err)
	}
	e.emitRunEvent(ctx, nil, "RunStarted", json.RawMessage(`{}`))

	entryNode := e.nodeByID(e.graph.EntryNodeID)
	if entryNode == nil {
		e.failRun(ctx, fmt.Sprintf("entry node %q not found in graph", e.graph.EntryNodeID))
		return fmt.Errorf("entry node %q not found in graph", e.graph.EntryNodeID)
	}
	if err := e.dispatchNode(ctx, entryNode, "main", e.run.InputJSON); err != nil {
		e.failRun(ctx, fmt.Sprintf("dispatch entry node: %v", err))
		return fmt.Errorf("dispatch entry node: %w", err)
	}
	return nil
}

// Advance processes one NodeResult for this run, advances the graph state, and
// dispatches the next node(s). It is called by the Dispatcher for every result
// that arrives on the event queue.
func (e *Engine) Advance(ctx context.Context, result model.NodeResult) error {
	if err := e.handleResult(ctx, result); err != nil {
		e.failRun(ctx, err.Error())
		return err
	}
	// Human-review pause: run is now waiting_for_human, nothing more to do.
	if e.state.HumanWait != nil {
		return nil
	}
	if len(e.state.PendingNodes) == 0 {
		e.completeRun(ctx)
	}
	return nil
}

func (e *Engine) handleResult(ctx context.Context, result model.NodeResult) error {
	now := time.Now()
	nodeRunUUID := result.NodeRunID

	// Persist worker events to DB for the replay/reconnect path.
	// The worker already published them to the run's pub/sub channel in real-time,
	// so we do NOT re-publish here to avoid duplicates on the SSE stream.
	for _, we := range result.Events {
		_ = e.eventRepo.Insert(ctx, e.run.ID, &nodeRunUUID,
			e.run.TenantID, e.run.WorkspaceID, we.EventType, we.PayloadJSON)
	}

	// Human review pause — intercept before normal completion flow.
	for _, we := range result.Events {
		if we.EventType == "HumanReviewRequested" {
			var payload struct {
				TaskID uuid.UUID `json:"task_id"`
			}
			_ = json.Unmarshal(we.PayloadJSON, &payload)
			e.state.HumanWait = &model.HumanWaitState{
				NodeID:    result.NodeID,
				NodeRunID: result.NodeRunID,
				TaskID:    payload.TaskID,
			}
			_ = e.runRepo.UpdateState(ctx, e.run.ID, e.state)
			fin := time.Now()
			_ = e.runRepo.UpdateStatus(ctx, e.run.ID, "waiting_for_human", &fin)
			return nil
		}
	}

	if result.Status == "failed" {
		errJSON := []byte(fmt.Sprintf(`{"message":%q}`, result.ErrorMsg))
		_ = e.nodeRunRepo.UpdateError(ctx, result.NodeRunID, errJSON, now)
		nodeFailedPayload, _ := json.Marshal(map[string]string{"node_id": result.NodeID})
		e.emitRunEvent(ctx, &nodeRunUUID, "NodeFailed", json.RawMessage(nodeFailedPayload))
		return fmt.Errorf("node %s failed: %s", result.NodeID, result.ErrorMsg)
	}

	_ = e.nodeRunRepo.UpdateOutput(ctx, result.NodeRunID, "completed", result.OutputJSON, now)
	nodeCompletedPayload, _ := json.Marshal(map[string]string{"node_id": result.NodeID})
	e.emitRunEvent(ctx, &nodeRunUUID, "NodeCompleted", json.RawMessage(nodeCompletedPayload))

	delete(e.state.PendingNodes, result.NodeID)
	e.state.CompletedNodes[result.NodeID] = true
	if result.OutputJSON != nil {
		e.state.NodeOutputs[result.NodeID] = result.OutputJSON
	}
	_ = e.runRepo.UpdateState(ctx, e.run.ID, e.state)

	if err := e.checkAggregators(ctx, result.NodeID); err != nil {
		return err
	}

	return e.advanceFrom(ctx, result.NodeID, result.OutputJSON)
}

func (e *Engine) advanceFrom(ctx context.Context, nodeID string, prevOutput json.RawMessage) error {
	outgoing := e.outgoingEdges(nodeID)
	if len(outgoing) == 0 {
		return nil
	}

	srcNode := e.nodeByID(nodeID)

	switch srcNode.Type {
	case "if_else":
		return e.advanceIfElse(ctx, srcNode, outgoing, prevOutput)
	case "router":
		return e.advanceRouter(ctx, srcNode, outgoing, prevOutput)
	case "parallel":
		for _, edge := range outgoing {
			target := e.nodeByID(edge.Target)
			if target == nil {
				continue
			}
			if err := e.dispatchNode(ctx, target, edge.Label, prevOutput); err != nil {
				return err
			}
		}
		return nil
	default:
		edge := outgoing[0]
		target := e.nodeByID(edge.Target)
		if target == nil {
			return fmt.Errorf("target node %q not found", edge.Target)
		}
		return e.dispatchNode(ctx, target, "main", prevOutput)
	}
}

func (e *Engine) advanceIfElse(ctx context.Context, node *model.GraphNode, edges []model.GraphEdge, prevOutput json.RawMessage) error {
	var cfg model.NodeIfElseConfig
	if len(node.Data) > 0 {
		_ = json.Unmarshal(node.Data, &cfg)
	}

	label := "false"
	if e.evalExpression(cfg.Expression, prevOutput) {
		label = "true"
	}

	for _, edge := range edges {
		if edge.Label == label || edge.Label == "" {
			target := e.nodeByID(edge.Target)
			if target != nil {
				return e.dispatchNode(ctx, target, label, prevOutput)
			}
		}
	}
	return nil
}

func (e *Engine) advanceRouter(ctx context.Context, node *model.GraphNode, edges []model.GraphEdge, prevOutput json.RawMessage) error {
	var out map[string]json.RawMessage
	_ = json.Unmarshal(prevOutput, &out)

	route := "default"
	if r, ok := out["route"]; ok {
		_ = json.Unmarshal(r, &route)
	}

	for _, edge := range edges {
		if edge.Label == route || edge.Label == "default" {
			target := e.nodeByID(edge.Target)
			if target != nil {
				return e.dispatchNode(ctx, target, edge.Label, prevOutput)
			}
		}
	}
	return nil
}

func (e *Engine) checkAggregators(ctx context.Context, justCompletedNodeID string) error {
	for aggID, remaining := range e.state.ParallelWaiting {
		for _, edge := range e.graph.Edges {
			if edge.Target == aggID && edge.Source == justCompletedNodeID {
				e.state.ParallelWaiting[aggID] = remaining - 1
				if e.state.ParallelWaiting[aggID] <= 0 {
					delete(e.state.ParallelWaiting, aggID)
					aggNode := e.nodeByID(aggID)
					if aggNode != nil {
						combined := e.buildAggregatedInput(aggID)
						if err := e.dispatchNode(ctx, aggNode, "main", combined); err != nil {
							return err
						}
					}
				}
			}
		}
	}
	return nil
}

func (e *Engine) buildAggregatedInput(aggNodeID string) json.RawMessage {
	combined := map[string]json.RawMessage{}
	for _, edge := range e.graph.Edges {
		if edge.Target == aggNodeID {
			if out, ok := e.state.NodeOutputs[edge.Source]; ok {
				combined[edge.Source] = out
			}
		}
	}
	data, _ := json.Marshal(combined)
	return data
}

func (e *Engine) dispatchNode(ctx context.Context, node *model.GraphNode, branchKey string, input json.RawMessage) error {
	if input == nil {
		input = json.RawMessage(`{}`)
	}

	// Track iterations per node to prevent infinite loops.
	if e.state.NodeIterations == nil {
		e.state.NodeIterations = make(map[string]int)
	}
	e.state.NodeIterations[node.ID]++
	if e.state.NodeIterations[node.ID] > maxNodeIterations {
		return fmt.Errorf("node %s exceeded max iterations (%d)", node.ID, maxNodeIterations)
	}
	iteration := e.state.NodeIterations[node.ID]

	nodeRunID := uuid.New()
	now := time.Now()
	nr := &model.NodeRun{
		ID:          nodeRunID,
		TenantID:    e.run.TenantID,
		WorkspaceID: e.run.WorkspaceID,
		RunID:       e.run.ID,
		NodeID:      node.ID,
		NodeType:    node.Type,
		NodeName:    node.Label,
		Status:      "running",
		BranchKey:   branchKey,
		Iteration:   iteration,
		AttemptNo:   1,
		InputJSON:   input,
		StartedAt:   &now,
		CreatedAt:   now,
	}
	if err := e.nodeRunRepo.Insert(ctx, nr); err != nil {
		return fmt.Errorf("insert node_run for %s: %w", node.ID, err)
	}

	e.state.PendingNodes[node.ID] = true
	_ = e.runRepo.UpdateState(ctx, e.run.ID, e.state)
	nodeStartedPayload, _ := json.Marshal(map[string]string{"node_id": node.ID})
	e.emitRunEvent(ctx, &nodeRunID, "NodeStarted", json.RawMessage(nodeStartedPayload))

	if node.Type == "parallel" {
		outgoing := e.outgoingEdges(node.ID)
		for _, edge := range outgoing {
			for _, aggEdge := range e.graph.Edges {
				if aggEdge.Source == edge.Target {
					aggNode := e.nodeByID(aggEdge.Target)
					if aggNode != nil && aggNode.Type == "aggregator" {
						incomingCount := e.incomingEdgeCount(aggNode.ID)
						e.state.ParallelWaiting[aggNode.ID] = incomingCount
					}
				}
			}
		}
		_ = e.nodeRunRepo.UpdateOutput(ctx, nodeRunID, "completed", json.RawMessage(`{}`), now)
		delete(e.state.PendingNodes, node.ID)
		e.state.CompletedNodes[node.ID] = true
		return e.advanceFrom(ctx, node.ID, input)
	}

	if nodeTypesHandledByOrchestrator[node.Type] {
		return e.resolveInlineNode(ctx, node, nodeRunID, input, branchKey)
	}

	job := model.NodeJob{
		RunID:       e.run.ID,
		NodeRunID:   nodeRunID,
		TenantID:    e.run.TenantID,
		WorkspaceID: e.run.WorkspaceID,
		ThreadID:    e.run.ThreadID,
		NodeID:      node.ID,
		NodeType:    node.Type,
		NodeName:    node.Label,
		NodeConfig:  node.Data,
		InputJSON:   input,
	}
	if err := e.q.PushNodeJob(ctx, job); err != nil {
		return fmt.Errorf("push node job for %s: %w", node.ID, err)
	}
	return nil
}

func (e *Engine) resolveInlineNode(ctx context.Context, node *model.GraphNode, nodeRunID uuid.UUID, input json.RawMessage, branchKey string) error {
	now := time.Now()
	_ = e.nodeRunRepo.UpdateOutput(ctx, nodeRunID, "completed", input, now)
	delete(e.state.PendingNodes, node.ID)
	e.state.CompletedNodes[node.ID] = true
	e.state.NodeOutputs[node.ID] = input
	_ = e.runRepo.UpdateState(ctx, e.run.ID, e.state)
	inlineCompletedPayload, _ := json.Marshal(map[string]string{"node_id": node.ID})
	e.emitRunEvent(ctx, &nodeRunID, "NodeCompleted", json.RawMessage(inlineCompletedPayload))

	if node.Type == "end" {
		return nil
	}
	return e.advanceFrom(ctx, node.ID, input)
}

func (e *Engine) failRun(ctx context.Context, msg string) {
	now := time.Now()
	_ = e.runRepo.UpdateError(ctx, e.run.ID, msg, now)
	errPayload, _ := json.Marshal(map[string]string{"error": msg})
	e.emitRunEvent(ctx, nil, "RunFailed", json.RawMessage(errPayload))
}

func (e *Engine) completeRun(ctx context.Context) {
	now := time.Now()
	var output json.RawMessage = json.RawMessage(`{}`)
	for nodeID := range e.state.CompletedNodes {
		node := e.nodeByID(nodeID)
		if node != nil && node.Type == "end" {
			if out, ok := e.state.NodeOutputs[nodeID]; ok {
				output = out
			}
		}
	}
	_ = e.runRepo.UpdateOutput(ctx, e.run.ID, "completed", output, now)
	e.emitRunEvent(ctx, nil, "RunCompleted", json.RawMessage(`{}`))
}

func (e *Engine) emitRunEvent(ctx context.Context, nodeRunID *uuid.UUID, eventType string, payload json.RawMessage) {
	_ = e.eventRepo.Insert(ctx, e.run.ID, nodeRunID, e.run.TenantID, e.run.WorkspaceID, eventType, payload)
	e.publishSSE(ctx, model.SSEEvent{Type: eventType, Data: payload})
}

func (e *Engine) publishSSE(ctx context.Context, event model.SSEEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	channel := "run:" + e.run.ID.String() + ":stream"
	if err := e.q.Publish(ctx, channel, string(data)); err != nil {
		log.Printf("[engine] publish SSE event %s for run %s: %v", event.Type, e.run.ID, err)
	}
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

func (e *Engine) nodeByID(id string) *model.GraphNode {
	node, ok := e.graph.Nodes[id]
	if !ok {
		return nil
	}
	return &node
}

func (e *Engine) outgoingEdges(nodeID string) []model.GraphEdge {
	var out []model.GraphEdge
	for _, edge := range e.graph.Edges {
		if edge.Source == nodeID {
			out = append(out, edge)
		}
	}
	return out
}

func (e *Engine) incomingEdgeCount(nodeID string) int {
	count := 0
	for _, edge := range e.graph.Edges {
		if edge.Target == nodeID {
			count++
		}
	}
	return count
}

func (e *Engine) evalExpression(expr string, output json.RawMessage) bool {
	if expr == "" {
		return true
	}
	var data map[string]interface{}
	if err := json.Unmarshal(output, &data); err != nil {
		return false
	}

	expr = strings.TrimSpace(expr)
	for _, op := range []string{"==", "!="} {
		parts := strings.SplitN(expr, op, 2)
		if len(parts) != 2 {
			continue
		}
		lhs := strings.TrimSpace(parts[0])
		rhs := strings.TrimSpace(parts[1])
		field := strings.TrimPrefix(strings.TrimSuffix(strings.TrimSpace(lhs), "}}"), "{{.")
		val, ok := data[field]
		if !ok {
			return false
		}
		valStr := fmt.Sprintf("%v", val)
		rhs = strings.Trim(rhs, `"'`)
		switch op {
		case "==":
			return valStr == rhs
		case "!=":
			return valStr != rhs
		}
	}
	return false
}
