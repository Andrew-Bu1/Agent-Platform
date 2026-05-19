package worker

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/executor"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/queue"
	"github.com/redis/go-redis/v9"
)

// NodeWorker polls the node queue and dispatches jobs to the appropriate executor.
type NodeWorker struct {
	q                   *queue.Client
	nodeQueue           string
	agentExecutor       *executor.AgentExecutor
	humanReviewExecutor *executor.HumanReviewExecutor
	workerCount         int
}

func NewNodeWorker(
	q *queue.Client,
	nodeQueue string,
	agentExecutor *executor.AgentExecutor,
	humanReviewExecutor *executor.HumanReviewExecutor,
	workerCount int,
) *NodeWorker {
	return &NodeWorker{
		q:                   q,
		nodeQueue:           nodeQueue,
		agentExecutor:       agentExecutor,
		humanReviewExecutor: humanReviewExecutor,
		workerCount:         workerCount,
	}
}

// Start launches workerCount goroutines and blocks until ctx is cancelled.
func (w *NodeWorker) Start(ctx context.Context) {
	var wg sync.WaitGroup
	for i := 0; i < w.workerCount; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			log.Printf("[worker %d] started", id)
			w.loop(ctx, id)
			log.Printf("[worker %d] stopped", id)
		}(i)
	}
	wg.Wait()
}

func (w *NodeWorker) loop(ctx context.Context, workerID int) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		raw, err := w.q.BLPopNodeJob(ctx, 5*time.Second)
		if err != nil {
			if err == redis.Nil {
				continue
			}
			if ctx.Err() != nil {
				return
			}
			log.Printf("[worker %d] BLPop error: %v", workerID, err)
			continue
		}

		var job model.NodeJob
		if err := json.Unmarshal([]byte(raw), &job); err != nil {
			log.Printf("[worker %d] unmarshal NodeJob: %v", workerID, err)
			w.q.PushDLQ(ctx, w.nodeQueue, raw, "unmarshal: "+err.Error())
			continue
		}

		w.execute(ctx, workerID, job, raw)
	}
}

func (w *NodeWorker) execute(ctx context.Context, workerID int, job model.NodeJob, rawJob string) {
	log.Printf("[worker %d] executing node %s (type=%s, run=%s)", workerID, job.NodeID, job.NodeType, job.RunID)

	var (
		output json.RawMessage
		events []model.WorkerEvent
		execErr error
	)

	switch job.NodeType {
	case "agent", "agent_team":
		output, events, execErr = w.agentExecutor.Execute(ctx, job)
	case "human_review":
		output, events, execErr = w.humanReviewExecutor.Execute(ctx, job)
	default:
		execErr = &unsupportedNodeTypeError{nodeType: job.NodeType}
	}

	result := model.NodeResult{
		RunID:     job.RunID,
		NodeRunID: job.NodeRunID,
		TenantID:  job.TenantID,
		NodeID:    job.NodeID,
		Events:    events,
	}

	if execErr != nil {
		log.Printf("[worker %d] node %s failed: %v", workerID, job.NodeID, execErr)
		result.Status = "failed"
		result.ErrorMsg = execErr.Error()
		if pushErr := w.q.PushNodeResult(ctx, result); pushErr != nil {
			log.Printf("[worker %d] push NodeResult (failed) error: %v", workerID, pushErr)
			w.q.PushDLQ(ctx, w.nodeQueue, rawJob, pushErr.Error())
		}
		return
	}

	result.Status = "completed"
	result.OutputJSON = output
	if pushErr := w.q.PushNodeResult(ctx, result); pushErr != nil {
		log.Printf("[worker %d] push NodeResult error: %v", workerID, pushErr)
		w.q.PushDLQ(ctx, w.nodeQueue, rawJob, pushErr.Error())
	}
}

type unsupportedNodeTypeError struct {
	nodeType string
}

func (e *unsupportedNodeTypeError) Error() string {
	return "unsupported node type: " + e.nodeType
}
