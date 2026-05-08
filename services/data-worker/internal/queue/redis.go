package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"libs/go/common/config"

	"github.com/redis/go-redis/v9"
)

// Client is a thin wrapper around go-redis for push/pop queue operations.
type Client struct {
	client *redis.Client
}

func NewClient(cfg *config.RedisConfig) *Client {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: cfg.User,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	return &Client{client: client}
}

// Push serialises payload to JSON and appends it to the right end of the list.
func (q *Client) Push(ctx context.Context, key string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("queue.Push marshal: %w", err)
	}
	if err := q.client.RPush(ctx, key, data).Err(); err != nil {
		return fmt.Errorf("queue.Push rpush %s: %w", key, err)
	}
	return nil
}

// BLPop blocks up to timeout for a message from key.
// Returns the raw JSON string. Returns ("", redis.Nil) when timed out.
func (q *Client) BLPop(ctx context.Context, timeout time.Duration, key string) (string, error) {
	results, err := q.client.BLPop(ctx, timeout, key).Result()
	if err != nil {
		return "", err
	}
	return results[1], nil
}

// Close shuts down the underlying Redis connection.
func (q *Client) Close() error {
	return q.client.Close()
}

// SetCounter sets a Redis key to val with a 24-hour TTL.
// Used by ChunkWorker to record how many embed jobs are expected per ingestion.
func (q *Client) SetCounter(ctx context.Context, key string, val int64) error {
	return q.client.Set(ctx, key, val, 24*time.Hour).Err()
}

// DecrAndGet atomically decrements the counter at key and returns the new value.
func (q *Client) DecrAndGet(ctx context.Context, key string) (int64, error) {
	return q.client.Decr(ctx, key).Result()
}

// PushDLQ appends a failed-job record to the dead-letter queue list.
func (q *Client) PushDLQ(ctx context.Context, dlqKey, sourceQueue, rawPayload, errMsg string) {
	entry, _ := json.Marshal(map[string]string{
		"queue":   sourceQueue,
		"payload": rawPayload,
		"error":   errMsg,
	})
	if err := q.client.RPush(ctx, dlqKey, entry).Err(); err != nil {
		// Best-effort: log but never panic on DLQ failure.
		fmt.Printf("[queue] warn: PushDLQ %s: %v\n", dlqKey, err)
	}
}
