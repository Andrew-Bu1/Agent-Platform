package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/queue"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/repository"
	"github.com/redis/go-redis/v9"
)

// Dispatcher polls the Redis event queue and advances the run state for each
// NodeResult. It is fully stateless: every goroutine loads run + graph + state
// from the database on demand, so any number of orchestrator instances can run
// concurrently without coordination.
type Dispatcher struct {
	q               *queue.Client
	runRepo         *repository.RunRepository
	nodeRunRepo     *repository.NodeRunRepository
	eventRepo       *repository.RunEventRepository
	flowVersionRepo *repository.FlowVersionRepository
	nodeQueue       string
	workerCount     int
}

func NewDispatcher(
	q *queue.Client,
	runRepo *repository.RunRepository,
	nodeRunRepo *repository.NodeRunRepository,
	eventRepo *repository.RunEventRepository,
	flowVersionRepo *repository.FlowVersionRepository,
	nodeQueue string,
	workerCount int,
) *Dispatcher {
	return &Dispatcher{
		q:               q,
		runRepo:         runRepo,
		nodeRunRepo:     nodeRunRepo,
		eventRepo:       eventRepo,
		flowVersionRepo: flowVersionRepo,
		nodeQueue:       nodeQueue,
		workerCount:     workerCount,
	}
}

// Start launches workerCount consumer goroutines.
func (d *Dispatcher) Start(ctx context.Context) {
	for i := 0; i < d.workerCount; i++ {
		go d.consume(ctx)
	}
}

func (d *Dispatcher) consume(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		raw, err := d.q.BLPopNodeResult(ctx, 5*time.Second)
		if err != nil {
			if err == redis.Nil {
				continue
			}
			if ctx.Err() != nil {
				return
			}
			log.Printf("[dispatcher] BLPop error: %v", err)
			continue
		}

		var result model.NodeResult
		if err := json.Unmarshal([]byte(raw), &result); err != nil {
			log.Printf("[dispatcher] unmarshal NodeResult: %v", err)
			d.q.PushDLQ(ctx, "event_queue", raw, fmt.Sprintf("unmarshal: %v", err))
			continue
		}

		if err := d.advance(ctx, result); err != nil {
			log.Printf("[dispatcher] advance run %s: %v", result.RunID, err)
		}
	}
}

// advance loads run + graph + state from DB for the given result, creates a
// short-lived Engine, and calls Engine.Advance. The Engine is discarded after
// the call — no goroutine is kept alive.
func (d *Dispatcher) advance(ctx context.Context, result model.NodeResult) error {
	run, err := d.runRepo.GetByIDOnly(ctx, result.RunID)
	if err != nil {
		return fmt.Errorf("load run: %w", err)
	}
	if run.TenantID != result.TenantID {
		return fmt.Errorf("tenant mismatch: result tenant %s does not match run tenant %s", result.TenantID, run.TenantID)
	}

	var state model.RunState
	if err := json.Unmarshal(run.StateJSON, &state); err != nil {
		return fmt.Errorf("unmarshal run state: %w", err)
	}

	fv, err := d.flowVersionRepo.GetByIDOnly(ctx, run.FlowVersionID)
	if err != nil {
		return fmt.Errorf("load flow version: %w", err)
	}

	var graph model.Graph
	if err := json.Unmarshal(fv.GraphJSON, &graph); err != nil {
		return fmt.Errorf("unmarshal graph: %w", err)
	}
	graph.PopulateNodeIDs()

	eng := NewEngine(run, &graph, &state, d.runRepo, d.nodeRunRepo, d.eventRepo, d.q, d.nodeQueue)
	return eng.Advance(ctx, result)
}
