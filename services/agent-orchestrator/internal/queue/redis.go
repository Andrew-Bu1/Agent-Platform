package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"libs/go/common/config"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	client     *redis.Client
	nodeQueue  string
	eventQueue string
	dlqKey     string
}

func NewClient(cfg *config.RedisConfig, nodeQueue, eventQueue, dlqKey string) *Client {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: cfg.User,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	return &Client{
		client:     client,
		nodeQueue:  nodeQueue,
		eventQueue: eventQueue,
		dlqKey:     dlqKey,
	}
}

// PushNodeJob serialises a NodeJob and appends it to the node queue.
func (q *Client) PushNodeJob(ctx context.Context, job model.NodeJob) error {
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("queue.PushNodeJob marshal: %w", err)
	}
	if err := q.client.RPush(ctx, q.nodeQueue, data).Err(); err != nil {
		return fmt.Errorf("queue.PushNodeJob rpush: %w", err)
	}
	return nil
}

// BLPopNodeResult blocks up to timeout waiting for a NodeResult from the event queue.
// Returns ("", redis.Nil) on timeout.
func (q *Client) BLPopNodeResult(ctx context.Context, timeout time.Duration) (string, error) {
	results, err := q.client.BLPop(ctx, timeout, q.eventQueue).Result()
	if err != nil {
		return "", err
	}
	return results[1], nil
}

// PushDLQ pushes a failed payload to the dead-letter queue.
func (q *Client) PushDLQ(ctx context.Context, sourceQueue, rawPayload, errMsg string) {
	entry := model.DLQEntry{
		Queue:   sourceQueue,
		Payload: rawPayload,
		Error:   errMsg,
	}
	data, _ := json.Marshal(entry)
	_ = q.client.RPush(ctx, q.dlqKey, data).Err()
}

// Publish publishes a message to a Redis Pub/Sub channel.
func (q *Client) Publish(ctx context.Context, channel, message string) error {
	return q.client.Publish(ctx, channel, message).Err()
}

// Subscribe returns a PubSub handle for the given channel.
func (q *Client) Subscribe(ctx context.Context, channel string) *redis.PubSub {
	return q.client.Subscribe(ctx, channel)
}

func (q *Client) Close() error {
	return q.client.Close()
}
