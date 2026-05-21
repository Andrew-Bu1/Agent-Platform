package worker

import (
	"context"
	"encoding/json"
	"log"
	"path/filepath"
	"time"

	"services/data-worker/internal/model"
	"services/data-worker/internal/parser"
	"services/data-worker/internal/queue"

	"libs/go/common/config"
	"libs/go/common/storage"

	"github.com/jackc/pgx/v5/pgxpool"
)

// IngestionWorker reads from the ingestion queue, downloads the document from
// MinIO, extracts its plain text, and pushes a ChunkingJob to the chunking
// queue for the ChunkWorker to process.
type IngestionWorker struct {
	q              *queue.Client
	minio          *storage.MinioStorage
	db             *pgxpool.Pool
	ingestionQueue string
	chunkingQueue  string
	dlqKey         string
}

func NewIngestionWorker(
	redisCfg *config.RedisConfig,
	minioCfg *config.MinioConfig,
	db *pgxpool.Pool,
	ingestionQueue, chunkingQueue, dlqKey string,
) (*IngestionWorker, error) {
	minioStorage, err := storage.NewMinioStorage(minioCfg)
	if err != nil {
		return nil, err
	}
	return &IngestionWorker{
		q:              queue.NewClient(redisCfg),
		minio:          minioStorage,
		db:             db,
		ingestionQueue: ingestionQueue,
		chunkingQueue:  chunkingQueue,
		dlqKey:         dlqKey,
	}, nil
}

// Run blocks and processes jobs from the ingestion queue until ctx is done.
func (w *IngestionWorker) Run(ctx context.Context) {
	log.Println("[IngestionWorker] started, listening on", w.ingestionQueue)
	for {
		select {
		case <-ctx.Done():
			log.Println("[IngestionWorker] shutting down")
			return
		default:
		}

		raw, err := w.q.BLPop(ctx, 5*time.Second, w.ingestionQueue)
		if err != nil {
			continue // redis.Nil (timeout) or ctx cancelled
		}

		var job model.IngestionJob
		if err := json.Unmarshal([]byte(raw), &job); err != nil {
			log.Printf("[IngestionWorker] unmarshal error: %v — payload: %s", err, raw)
			continue
		}

		w.setIngestionStatus(ctx, job.IngestionID, "processing")
		if err := w.process(ctx, job); err != nil {
			log.Printf("[IngestionWorker] error ingestion_id=%s: %v", job.IngestionID, err)
			w.setIngestionStatus(ctx, job.IngestionID, "failed")
			w.q.PushDLQ(ctx, w.dlqKey+":"+job.TenantID, w.ingestionQueue, raw, err.Error())
		}
	}
}

func (w *IngestionWorker) process(ctx context.Context, job model.IngestionJob) error {
	log.Printf("[IngestionWorker] processing ingestion_id=%s document_id=%s", job.IngestionID, job.DocumentID)

	// Download file bytes from MinIO using the storage_path as object name.
	data, err := w.minio.DownloadFile(ctx, job.StoragePath)
	if err != nil {
		return err
	}

	// Determine filename from path for extension detection.
	filename := job.Filename
	if filename == "" {
		filename = filepath.Base(job.StoragePath)
	}

	// Extract plain text from the document.
	text, err := parser.ExtractText(data, filename)
	if err != nil {
		return err
	}
	if text == "" {
		log.Printf("[IngestionWorker] warn: empty text extracted from %s — marking completed", job.StoragePath)
		w.setIngestionStatus(ctx, job.IngestionID, "completed")
		return nil
	}

	// Push a ChunkingJob so the ChunkWorker can apply the strategy.
	chunkJob := model.ChunkingJob{
		IngestionID:    job.IngestionID,
		DocumentID:     job.DocumentID,
		TenantID:       job.TenantID,
		WorkspaceID:    job.WorkspaceID,
		Text:           text,
		ChunkStrategy:  job.ChunkStrategy,
		ChunkConfig:    job.ChunkConfig,
		EmbeddingModel: job.EmbeddingModel,
		Mode:           job.Mode,
	}
	if err := w.q.Push(ctx, w.chunkingQueue, chunkJob); err != nil {
		return err
	}

	log.Printf("[IngestionWorker] ingestion_id=%s queued for chunking (%d chars)", job.IngestionID, len(text))
	return nil
}

func (w *IngestionWorker) setIngestionStatus(ctx context.Context, ingestionID, status string) {
	_, err := w.db.Exec(ctx,
		`UPDATE ingestions SET status = $1, updated_at = $2 WHERE id = $3`,
		status, time.Now().UTC(), ingestionID,
	)
	if err != nil {
		log.Printf("[IngestionWorker] warn: update status ingestion_id=%s status=%s: %v", ingestionID, status, err)
	}
}
