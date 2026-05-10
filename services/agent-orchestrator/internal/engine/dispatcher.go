package engine

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/queue"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Dispatcher polls the Redis event queue and routes NodeResults to the
// correct Engine by run_id.
type Dispatcher struct {
	q           *queue.Client
	workerCount int
	mu          sync.RWMutex
	engines     map[uuid.UUID]*Engine
}

func NewDispatcher(q *queue.Client, workerCount int) *Dispatcher {
	return &Dispatcher{
		q:           q,
		workerCount: workerCount,
		engines:     make(map[uuid.UUID]*Engine),
	}
}

// Resume injects a NodeResult into the engine for a waiting run (e.g., after human review).
// Returns false if the engine is not registered or doesn't consume within 5 s.
func (d *Dispatcher) Resume(runID uuid.UUID, result model.NodeResult) bool {
	d.mu.RLock()
	eng, ok := d.engines[runID]
	d.mu.RUnlock()
	if !ok {
		return false
	}
	select {
	case eng.ResultCh() <- result:
		return true
	case <-time.After(5 * time.Second):
		return false
	}
}

// Register makes the dispatcher route results for this engine's run.
func (d *Dispatcher) Register(e *Engine) {
	d.mu.Lock()
	d.engines[e.run.ID] = e
	d.mu.Unlock()

	// Deregister when engine finishes.
	go func() {
		<-e.DoneCh()
		d.mu.Lock()
		delete(d.engines, e.run.ID)
		d.mu.Unlock()
	}()
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
			continue
		}

		d.mu.RLock()
		eng, ok := d.engines[result.RunID]
		d.mu.RUnlock()

		if !ok {
			log.Printf("[dispatcher] no engine for run %s — result dropped", result.RunID)
			continue
		}

		select {
		case eng.ResultCh() <- result:
		case <-time.After(5 * time.Second):
			log.Printf("[dispatcher] engine for run %s is not consuming results (timeout)", result.RunID)
		}
	}
}
