package executor

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/repository"
	"github.com/google/uuid"
)

// HumanReviewExecutor handles human_review nodes.
// It inserts a human_review_tasks row and emits a HumanReviewRequested event.
// The run is left in waiting_for_human — resumption is handled externally
// (e.g., via an API call from the review UI).
type HumanReviewExecutor struct {
	humanReviewRepo *repository.HumanReviewRepository
	nodeRunRepo     *repository.NodeRunRepository
	eventPub        EventPublisher // nil disables real-time publishing (tests)
}

func NewHumanReviewExecutor(
	humanReviewRepo *repository.HumanReviewRepository,
	nodeRunRepo *repository.NodeRunRepository,
	eventPub EventPublisher,
) *HumanReviewExecutor {
	return &HumanReviewExecutor{
		humanReviewRepo: humanReviewRepo,
		nodeRunRepo:     nodeRunRepo,
		eventPub:        eventPub,
	}
}

// Execute creates the human review task and returns events.
// Note: the worker returns Status="completed" so the orchestrator sees the node
// as done; the RUN itself is put into waiting_for_human by the orchestrator
// when it detects the HumanReviewRequested event.
func (e *HumanReviewExecutor) Execute(ctx context.Context, job model.NodeJob) (json.RawMessage, []model.WorkerEvent, error) {
	_ = e.nodeRunRepo.SetStarted(ctx, job.NodeRunID, time.Now())

	task := &model.HumanReviewTask{
		ID:          uuid.New(),
		TenantID:    job.TenantID,
		WorkspaceID: job.WorkspaceID,
		RunID:       job.RunID,
		NodeRunID:   job.NodeRunID,
		ThreadID:    job.ThreadID,
		Payload:     job.InputJSON,
		Status:      "waiting",
	}

	if err := e.humanReviewRepo.Insert(ctx, task); err != nil {
		return nil, nil, err
	}

	reviewPayload, _ := json.Marshal(map[string]interface{}{
		"task_id":     task.ID,
		"run_id":      job.RunID,
		"node_run_id": job.NodeRunID,
	})

	events := []model.WorkerEvent{{
		EventType:   "HumanReviewRequested",
		PayloadJSON: json.RawMessage(reviewPayload),
	}}

	// Publish in real-time so the client knows immediately that human input is needed.
	if e.eventPub != nil {
		ev, _ := json.Marshal(struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		}{"HumanReviewRequested", reviewPayload})
		_ = e.eventPub.PublishEvent(ctx, job.RunID, ev)
	}

	output, _ := json.Marshal(map[string]interface{}{
		"task_id": task.ID,
		"status":  "waiting",
	})

	return json.RawMessage(output), events, nil
}
