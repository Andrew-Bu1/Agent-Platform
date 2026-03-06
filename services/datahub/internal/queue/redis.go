package queue

import (
	"context"
	"encoding/json"
	"fmt"

	"libs/go/common/config"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const ChunkQueueKey = "datahub:chunk"

// ChunkJob is the payload pushed onto the queue.
// The data-worker pops this and performs the actual chunking + embedding.
type ChunkJob struct {
	IngestionID    uuid.UUID `json:"ingestion_id"`
	DocumentID     uuid.UUID `json:"document_id"`
	StoragePath    string    `json:"storage_path"`
	ChunkStrategy  string    `json:"chunk_strategy"`
	EmbeddingModel string    `json:"embedding_model"`
}

type RedisQueue struct {
	client *redis.Client
}

func NewRedisQueue(cfg *config.RedisConfig) *RedisQueue {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: cfg.User,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	return &RedisQueue{client: client}
}

// Publish pushes a ChunkJob as JSON onto the right end of the Redis list.
// The data-worker consumes jobs with BLPOP from the left.
func (q *RedisQueue) Publish(ctx context.Context, job ChunkJob) error {
	payload, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("queue.Publish marshal: %w", err)
	}
	if err := q.client.RPush(ctx, ChunkQueueKey, payload).Err(); err != nil {
		return fmt.Errorf("queue.Publish rpush: %w", err)
	}
	return nil
}

func (q *RedisQueue) Close() error {
	return q.client.Close()
}
