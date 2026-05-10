package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/engine"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/queue"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/repository"
	"github.com/google/uuid"
)

type RunService struct {
	runRepo         *repository.RunRepository
	nodeRunRepo     *repository.NodeRunRepository
	eventRepo       *repository.RunEventRepository
	flowVersionRepo *repository.FlowVersionRepository
	q               *queue.Client
	dispatcher      *engine.Dispatcher
	nodeQueue       string
}

func NewRunService(
	runRepo *repository.RunRepository,
	nodeRunRepo *repository.NodeRunRepository,
	eventRepo *repository.RunEventRepository,
	flowVersionRepo *repository.FlowVersionRepository,
	q *queue.Client,
	dispatcher *engine.Dispatcher,
	nodeQueue string,
) *RunService {
	return &RunService{
		runRepo:         runRepo,
		nodeRunRepo:     nodeRunRepo,
		eventRepo:       eventRepo,
		flowVersionRepo: flowVersionRepo,
		q:               q,
		dispatcher:      dispatcher,
		nodeQueue:       nodeQueue,
	}
}

// CreateAndStream creates a new run, starts its engine, and returns an event channel
// that streams SSEEvents until the run finishes or ctx is cancelled.
func (s *RunService) CreateAndStream(
	ctx context.Context,
	req model.CreateRunRequest,
	tenantID, workspaceID uuid.UUID,
) (*model.Run, <-chan model.SSEEvent, error) {
	fv, err := s.flowVersionRepo.GetByID(ctx, req.FlowVersionID, tenantID, workspaceID)
	if err != nil {
		return nil, nil, fmt.Errorf("flow version not found: %w", err)
	}
	if fv.Status != "published" {
		return nil, nil, fmt.Errorf("flow version is not published (status: %s)", fv.Status)
	}

	input := req.Input
	if input == nil {
		input = json.RawMessage(`{}`)
	}

	initState := model.NewRunState()
	stateJSON, _ := json.Marshal(initState)

	now := time.Now()
	run := &model.Run{
		ID:            uuid.New(),
		TenantID:      tenantID,
		WorkspaceID:   workspaceID,
		ThreadID:      req.ThreadID,
		FlowID:        &fv.FlowID,
		FlowVersionID: fv.ID,
		Status:        "pending",
		InputJSON:     input,
		StateJSON:     stateJSON,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.runRepo.Insert(ctx, run); err != nil {
		return nil, nil, fmt.Errorf("insert run: %w", err)
	}

	var graph model.Graph
	if err := json.Unmarshal(fv.GraphJSON, &graph); err != nil {
		return nil, nil, fmt.Errorf("parse graph_json: %w", err)
	}

	// Subscribe before starting the engine so no early events are missed.
	channel := "run:" + run.ID.String() + ":stream"
	pubsub := s.q.Subscribe(context.Background(), channel)

	eng := engine.NewEngine(run, &graph, initState, s.runRepo, s.nodeRunRepo, s.eventRepo, s.q, s.nodeQueue)
	s.dispatcher.Register(eng)
	go eng.Run(context.Background())

	eventCh := make(chan model.SSEEvent, 128)

	go func() {
		defer close(eventCh)
		defer pubsub.Close()

		redisCh := pubsub.Channel()
		var engDone <-chan struct{} = eng.DoneCh()
		var drainDeadline <-chan time.Time

		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-redisCh:
				if !ok {
					return
				}
				var ev model.SSEEvent
				if err := json.Unmarshal([]byte(msg.Payload), &ev); err != nil {
					continue
				}
				select {
				case eventCh <- ev:
				case <-ctx.Done():
					return
				}
				if isTerminalEvent(ev.Type) {
					return
				}
			case <-engDone:
				// Engine done; allow 300 ms for in-flight pub/sub messages to arrive.
				engDone = nil
				drainDeadline = time.After(300 * time.Millisecond)
			case <-drainDeadline:
				return
			}
		}
	}()

	return run, eventCh, nil
}

// WatchRun subscribes to an existing run's event stream for the reconnect path.
// Historical events since fromSeq are replayed first, then live events follow.
func (s *RunService) WatchRun(
	ctx context.Context,
	id, tenantID, workspaceID uuid.UUID,
	fromSeq int64,
) (<-chan model.SSEEvent, error) {
	run, err := s.runRepo.GetByID(ctx, id, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}

	// Subscribe before fetching history to avoid a gap.
	channel := "run:" + id.String() + ":stream"
	pubsub := s.q.Subscribe(ctx, channel)

	eventCh := make(chan model.SSEEvent, 128)

	go func() {
		defer close(eventCh)
		defer pubsub.Close()

		// Replay historical structural events.
		history, err := s.eventRepo.ListFromSeq(ctx, id, tenantID, workspaceID, fromSeq, 1000)
		if err == nil {
			for _, ev := range history {
				select {
				case eventCh <- model.SSEEvent{Type: ev.EventType, Data: ev.PayloadJSON}:
				case <-ctx.Done():
					return
				}
			}
		}

		if isTerminalStatus(run.Status) {
			return
		}

		redisCh := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-redisCh:
				if !ok {
					return
				}
				var ev model.SSEEvent
				if err := json.Unmarshal([]byte(msg.Payload), &ev); err != nil {
					continue
				}
				select {
				case eventCh <- ev:
				case <-ctx.Done():
					return
				}
				if isTerminalEvent(ev.Type) {
					return
				}
			}
		}
	}()

	return eventCh, nil
}

// GetByID retrieves a run.
func (s *RunService) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.RunResponse, error) {
	run, err := s.runRepo.GetByID(ctx, id, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}
	return toRunResponse(run), nil
}

// Cancel marks a run as cancelled if it is still active.
func (s *RunService) Cancel(ctx context.Context, id, tenantID, workspaceID uuid.UUID) error {
	run, err := s.runRepo.GetByID(ctx, id, tenantID, workspaceID)
	if err != nil {
		return err
	}
	if run.Status != "pending" && run.Status != "running" && run.Status != "waiting_for_human" {
		return fmt.Errorf("run is already in terminal status: %s", run.Status)
	}
	now := time.Now()
	return s.runRepo.UpdateStatus(ctx, id, "cancelled", &now)
}

// ResumeHumanReview resumes a run that is waiting_for_human by injecting a
// NodeResult into the active engine.
func (s *RunService) ResumeHumanReview(
	ctx context.Context,
	runID, taskID uuid.UUID,
	output json.RawMessage,
	tenantID, workspaceID uuid.UUID,
) error {
	run, err := s.runRepo.GetByID(ctx, runID, tenantID, workspaceID)
	if err != nil {
		return err
	}
	if run.Status != "waiting_for_human" {
		return fmt.Errorf("run is not waiting for human review (status: %s)", run.Status)
	}

	var state model.RunState
	if err := json.Unmarshal(run.StateJSON, &state); err != nil {
		return fmt.Errorf("parse run state: %w", err)
	}
	if state.HumanWait == nil {
		return fmt.Errorf("run has no pending human review task")
	}
	if state.HumanWait.TaskID != taskID {
		return fmt.Errorf("task_id does not match the waiting task")
	}

	hw := *state.HumanWait
	state.HumanWait = nil

	if err := s.runRepo.UpdateState(ctx, runID, &state); err != nil {
		return fmt.Errorf("clear human_wait state: %w", err)
	}
	if err := s.runRepo.UpdateStatus(ctx, runID, "running", nil); err != nil {
		return fmt.Errorf("update run status: %w", err)
	}

	if output == nil {
		output = json.RawMessage(`{}`)
	}

	result := model.NodeResult{
		RunID:      runID,
		NodeRunID:  hw.NodeRunID,
		NodeID:     hw.NodeID,
		Status:     "completed",
		OutputJSON: output,
	}
	if !s.dispatcher.Resume(runID, result) {
		return fmt.Errorf("engine not active for run %s — it may have been restarted", runID)
	}
	return nil
}

func toRunResponse(r *model.Run) *model.RunResponse {
	return &model.RunResponse{
		ID:            r.ID,
		FlowVersionID: r.FlowVersionID,
		ThreadID:      r.ThreadID,
		Status:        r.Status,
		InputJSON:     r.InputJSON,
		OutputJSON:    r.OutputJSON,
		ErrorJSON:     r.ErrorJSON,
		StartedAt:     r.StartedAt,
		FinishedAt:    r.FinishedAt,
		CreatedAt:     r.CreatedAt,
	}
}

func isTerminalStatus(s string) bool {
	return s == "completed" || s == "failed" || s == "cancelled"
}

func isTerminalEvent(t string) bool {
	return t == "RunCompleted" || t == "RunFailed" || t == "RunCancelled"
}
