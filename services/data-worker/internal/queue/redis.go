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

// DLQEntry is the envelope stored in the dead-letter queue list.
type DLQEntry struct {
	Queue     string `json:"queue"`
	Payload   string `json:"payload"`
	Error     string `json:"error"`
	QueuedAt  string `json:"queued_at"`
}

// PushDLQ appends a failed-job record to the dead-letter queue list.
func (q *Client) PushDLQ(ctx context.Context, dlqKey, sourceQueue, rawPayload, errMsg string) {
	entry, _ := json.Marshal(DLQEntry{
		Queue:    sourceQueue,
		Payload:  rawPayload,
		Error:    errMsg,
		QueuedAt: time.Now().UTC().Format(time.RFC3339),
	})
	if err := q.client.RPush(ctx, dlqKey, entry).Err(); err != nil {
		// Best-effort: log but never panic on DLQ failure.
		fmt.Printf("[queue] warn: PushDLQ %s: %v\n", dlqKey, err)
	}
}

// DLQLen returns the number of entries currently in the dead-letter queue.
func (q *Client) DLQLen(ctx context.Context, dlqKey string) (int64, error) {
	return q.client.LLen(ctx, dlqKey).Result()
}

// DLQList returns up to limit entries from the dead-letter queue without removing them.
func (q *Client) DLQList(ctx context.Context, dlqKey string, limit int64) ([]DLQEntry, error) {
	raws, err := q.client.LRange(ctx, dlqKey, 0, limit-1).Result()
	if err != nil {
		return nil, fmt.Errorf("queue.DLQList: %w", err)
	}
	entries := make([]DLQEntry, 0, len(raws))
	for _, raw := range raws {
		var e DLQEntry
		if err := json.Unmarshal([]byte(raw), &e); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}

// DLQReplay pops every entry from the dead-letter queue and pushes each
// payload back to its original source queue. Returns the number replayed.
func (q *Client) DLQReplay(ctx context.Context, dlqKey string) (int, error) {
	replayed := 0
	for {
		raw, err := q.client.LPop(ctx, dlqKey).Result()
		if err == redis.Nil {
			break
		}
		if err != nil {
			return replayed, fmt.Errorf("queue.DLQReplay lpop: %w", err)
		}
		var e DLQEntry
		if err := json.Unmarshal([]byte(raw), &e); err != nil {
			continue
		}
		if err := q.client.RPush(ctx, e.Queue, e.Payload).Err(); err != nil {
			// Re-queue the entry back to DLQ so it isn't lost.
			q.client.RPush(ctx, dlqKey, raw)
			return replayed, fmt.Errorf("queue.DLQReplay rpush to %s: %w", e.Queue, err)
		}
		replayed++
	}
	return replayed, nil
}

// DLQClear deletes all entries from the dead-letter queue.
func (q *Client) DLQClear(ctx context.Context, dlqKey string) error {
	return q.client.Del(ctx, dlqKey).Err()
}
