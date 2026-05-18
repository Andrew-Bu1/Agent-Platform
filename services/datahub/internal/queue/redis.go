package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"libs/go/common/config"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// IngestionJob is the payload pushed onto the ingestion queue.
// The IngestionWorker in data-worker pops this, downloads the file from MinIO,
// and begins the chunking pipeline.
type IngestionJob struct {
	IngestionID    uuid.UUID       `json:"ingestion_id"`
	DocumentID     uuid.UUID       `json:"document_id"`
	TenantID       uuid.UUID       `json:"tenant_id"`
	WorkspaceID    uuid.UUID       `json:"workspace_id"`
	StoragePath    string          `json:"storage_path"`
	Filename       string          `json:"filename"`
	ChunkStrategy  string          `json:"chunk_strategy"`
	ChunkConfig    json.RawMessage `json:"chunk_config"`
	EmbeddingModel string          `json:"embedding_model"`
}



type RedisQueue struct {
	client 			*redis.Client
	IngestionQueue 	string
}

func NewRedisQueue(cfg *config.RedisConfig, queueKey string) *RedisQueue {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: cfg.User,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	return &RedisQueue{client: client, IngestionQueue: queueKey}
}

// Publish pushes an IngestionJob as JSON onto the right end of the Redis list.
// The data-worker consumes jobs with BLPOP from the left.
func (q *RedisQueue) Publish(ctx context.Context, job IngestionJob) error {
	payload, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("queue.Publish marshal: %w", err)
	}
	if err := q.client.RPush(ctx, q.IngestionQueue, payload).Err(); err != nil {
		return fmt.Errorf("queue.Publish rpush: %w", err)
	}
	return nil
}

func (q *RedisQueue) Close() error {
	return q.client.Close()
}

// DLQEntry is the envelope written to the dead-letter queue by data-worker.
type DLQEntry struct {
	Queue    string `json:"queue"`
	Payload  string `json:"payload"`
	Error    string `json:"error"`
	QueuedAt string `json:"queued_at"`
}

// DLQLen returns the number of entries currently in the dead-letter queue.
func (q *RedisQueue) DLQLen(ctx context.Context, dlqKey string) (int64, error) {
	return q.client.LLen(ctx, dlqKey).Result()
}

// DLQList returns up to limit entries from the dead-letter queue without removing them.
func (q *RedisQueue) DLQList(ctx context.Context, dlqKey string, limit int64) ([]DLQEntry, error) {
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
func (q *RedisQueue) DLQReplay(ctx context.Context, dlqKey string) (int, error) {
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
func (q *RedisQueue) DLQClear(ctx context.Context, dlqKey string) error {
	return q.client.Del(ctx, dlqKey).Err()
}
