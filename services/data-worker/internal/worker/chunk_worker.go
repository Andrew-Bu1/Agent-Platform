package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"services/data-worker/internal/chunker"
	"services/data-worker/internal/model"
	"services/data-worker/internal/queue"

	"libs/go/common/config"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ChunkWorker reads ChunkingJobs from the chunking queue, applies the requested
// chunking strategy, persists chunks to the `chunk` table, and pushes an
// EmbedJob per chunk to the embedding queue.
type ChunkWorker struct {
	q              *queue.Client
	db             *pgxpool.Pool
	chunkingQueue  string
	embeddingQueue string
	dlqKey         string
}

func NewChunkWorker(
	redisCfg *config.RedisConfig,
	db *pgxpool.Pool,
	chunkingQueue, embeddingQueue, dlqKey string,
) *ChunkWorker {
	return &ChunkWorker{
		q:              queue.NewClient(redisCfg),
		db:             db,
		chunkingQueue:  chunkingQueue,
		embeddingQueue: embeddingQueue,
		dlqKey:         dlqKey,
	}
}

// Run blocks and processes jobs from the chunking queue until ctx is done.
func (w *ChunkWorker) Run(ctx context.Context) {
	log.Println("[ChunkWorker] started, listening on", w.chunkingQueue)
	for {
		select {
		case <-ctx.Done():
			log.Println("[ChunkWorker] shutting down")
			return
		default:
		}

		raw, err := w.q.BLPop(ctx, 5*time.Second, w.chunkingQueue)
		if err != nil {
			continue
		}

		var job model.ChunkingJob
		if err := json.Unmarshal([]byte(raw), &job); err != nil {
			log.Printf("[ChunkWorker] unmarshal error: %v", err)
			continue
		}

		if err := w.process(ctx, job); err != nil {
			log.Printf("[ChunkWorker] error ingestion_id=%s: %v", job.IngestionID, err)
			w.setIngestionStatus(ctx, job.IngestionID, "failed")
			w.q.PushDLQ(ctx, w.dlqKey, w.chunkingQueue, raw, err.Error())
		}
	}
}

func (w *ChunkWorker) process(ctx context.Context, job model.ChunkingJob) error {
	log.Printf("[ChunkWorker] chunking ingestion_id=%s strategy=%s", job.IngestionID, job.ChunkStrategy)

	// Look up the datasource_id associated with the document, scoped to the tenant.
	datasourceID, err := w.getDatasourceID(ctx, job.DocumentID, job.TenantID, job.WorkspaceID)
	if err != nil {
		return fmt.Errorf("getDatasourceID: %w", err)
	}

	// Build the requested chunker.
	c, err := chunker.New(job.ChunkStrategy, job.ChunkConfig)
	if err != nil {
		return fmt.Errorf("chunker.New: %w", err)
	}

	chunks, err := c.Chunk(job.Text)
	if err != nil {
		return fmt.Errorf("chunk: %w", err)
	}
	log.Printf("[ChunkWorker] ingestion_id=%s → %d chunks", job.IngestionID, len(chunks))

	// If the document produced no chunks (e.g. empty file), mark completed immediately.
	if len(chunks) == 0 {
		w.setIngestionStatus(ctx, job.IngestionID, "completed")
		return nil
	}

	// Set the embed-completion counter BEFORE pushing jobs to avoid a race where
	// EmbedWorker finishes all chunks before the counter is visible.
	counterKey := fmt.Sprintf("datahub:embed:remaining:%s", job.IngestionID)
	if err := w.q.SetCounter(ctx, counterKey, int64(len(chunks))); err != nil {
		return fmt.Errorf("set embed counter: %w", err)
	}

	now := time.Now().UTC()
	for _, ch := range chunks {
		chunkID := uuid.New()

		meta, _ := json.Marshal(map[string]any{
			"chunk_index":    ch.Index,
			"chunk_strategy": job.ChunkStrategy,
			"document_id":    job.DocumentID,
		})

		// Persist the chunk and always use the canonical row ID. On replay, the
		// conflict path returns the chunk written by the first successful run.
		err := w.db.QueryRow(ctx, `
				INSERT INTO chunks (id, tenant_id, workspace_id, document_id, ingestion_id, chunk_index, content, metadata, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
				ON CONFLICT (tenant_id, workspace_id, ingestion_id, chunk_index)
				DO UPDATE SET updated_at = EXCLUDED.updated_at
				RETURNING id`,
			chunkID, job.TenantID, job.WorkspaceID, job.DocumentID, job.IngestionID, ch.Index, ch.Content, meta, now, now,
		).Scan(&chunkID)
		if err != nil {
			return fmt.Errorf("insert chunk idx=%d: %w", ch.Index, err)
		}

		// Enqueue for embedding.
		embedJob := model.EmbedJob{
			IngestionID:    job.IngestionID,
			ChunkID:        chunkID.String(),
			DatasourceID:   datasourceID,
			TenantID:       job.TenantID,
			WorkspaceID:    job.WorkspaceID,
			Content:        ch.Content,
			EmbeddingModel: job.EmbeddingModel,
		}
		if err := w.q.Push(ctx, w.embeddingQueue, embedJob); err != nil {
			return fmt.Errorf("push embed job chunk_id=%s: %w", chunkID, err)
		}
	}

	w.setIngestionStatus(ctx, job.IngestionID, "chunked")
	log.Printf("[ChunkWorker] ingestion_id=%s chunked and queued for embedding", job.IngestionID)
	return nil
}

func (w *ChunkWorker) getDatasourceID(ctx context.Context, documentID, tenantID, workspaceID string) (string, error) {
	var id string
	err := w.db.QueryRow(ctx,
		`SELECT datasource_id FROM documents WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`,
		documentID, tenantID, workspaceID,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("query datasource_id for document_id=%s: %w", documentID, err)
	}
	return id, nil
}

func (w *ChunkWorker) setIngestionStatus(ctx context.Context, ingestionID, status string) {
	_, err := w.db.Exec(ctx,
		`UPDATE ingestions SET status = $1, updated_at = $2 WHERE id = $3`,
		status, time.Now().UTC(), ingestionID,
	)
	if err != nil {
		log.Printf("[ChunkWorker] warn: update status ingestion_id=%s status=%s: %v", ingestionID, status, err)
	}
}
