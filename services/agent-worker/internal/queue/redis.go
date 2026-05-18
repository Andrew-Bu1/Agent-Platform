package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	libconfig "libs/go/common/config"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Client struct {
	rdb        *redis.Client
	nodeQueue  string
	eventQueue string
	dlqKey     string
}

func NewClient(cfg *libconfig.RedisConfig, nodeQueue, eventQueue, dlqKey string) *Client {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: cfg.User,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	return &Client{rdb: rdb, nodeQueue: nodeQueue, eventQueue: eventQueue, dlqKey: dlqKey}
}

func (c *Client) Close() error {
	return c.rdb.Close()
}

// BLPopNodeJob blocks until a NodeJob is available, then returns it as JSON.
func (c *Client) BLPopNodeJob(ctx context.Context, timeout time.Duration) (string, error) {
	result, err := c.rdb.BLPop(ctx, timeout, c.nodeQueue).Result()
	if err != nil {
		return "", err
	}
	if len(result) < 2 {
		return "", fmt.Errorf("unexpected BLPop result length: %d", len(result))
	}
	return result[1], nil
}

// PushNodeResult pushes a NodeResult onto the orchestrator's event queue.
func (c *Client) PushNodeResult(ctx context.Context, result model.NodeResult) error {
	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("marshal NodeResult: %w", err)
	}
	return c.rdb.RPush(ctx, c.eventQueue, data).Err()
}

// PublishEvent publishes any SSE-envelope event to the run's Pub/Sub channel.
// Used for both streaming token deltas and structural events (AgentStarted, etc.)
// so that the client receives them in real-time rather than after node completion.
func (c *Client) PublishEvent(ctx context.Context, runID uuid.UUID, payload json.RawMessage) error {
	channel := "run:" + runID.String() + ":stream"
	return c.rdb.Publish(ctx, channel, string(payload)).Err()
}

// PushDLQ pushes a failed payload to the dead-letter queue.
func (c *Client) PushDLQ(ctx context.Context, sourceQueue, rawPayload, errMsg string) {
	entry := model.DLQEntry{
		Queue:   sourceQueue,
		Payload: rawPayload,
		Error:   errMsg,
	}
	data, _ := json.Marshal(entry)
	_ = c.rdb.RPush(ctx, c.dlqKey, data).Err()
}
