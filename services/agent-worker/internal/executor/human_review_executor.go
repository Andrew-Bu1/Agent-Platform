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
}

func NewHumanReviewExecutor(
	humanReviewRepo *repository.HumanReviewRepository,
	nodeRunRepo *repository.NodeRunRepository,
) *HumanReviewExecutor {
	return &HumanReviewExecutor{
		humanReviewRepo: humanReviewRepo,
		nodeRunRepo:     nodeRunRepo,
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

	payload, _ := json.Marshal(map[string]interface{}{
		"task_id":     task.ID,
		"run_id":      job.RunID,
		"node_run_id": job.NodeRunID,
	})

	events := []model.WorkerEvent{{
		EventType:   "HumanReviewRequested",
		PayloadJSON: json.RawMessage(payload),
	}}

	output, _ := json.Marshal(map[string]interface{}{
		"task_id": task.ID,
		"status":  "waiting",
	})

	return json.RawMessage(output), events, nil
}
