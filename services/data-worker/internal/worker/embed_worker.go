package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"services/data-worker/internal/model"
	"services/data-worker/internal/queue"

	"libs/go/common/config"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// embeddingDimTable maps vector dimension → postgres table name.
var embeddingDimTable = map[int]string{
	384:  "chunk_384dimension",
	768:  "chunk_768dimension",
	1024: "chunk_1024dimension",
}

// EmbedWorker reads EmbedJobs from the embedding queue, calls AIHub /v1/embed
// to get the vector, then inserts the result into the correct dimension table.
type EmbedWorker struct {
	q              *queue.Client
	db             *pgxpool.Pool
	embeddingQueue string
	aihubURL       string
	dlqKey         string
	httpClient     *http.Client
}

func NewEmbedWorker(
	redisCfg *config.RedisConfig,
	db *pgxpool.Pool,
	embeddingQueue, aihubURL, dlqKey string,
) *EmbedWorker {
	return &EmbedWorker{
		q:              queue.NewClient(redisCfg),
		db:             db,
		embeddingQueue: embeddingQueue,
		aihubURL:       aihubURL,
		dlqKey:         dlqKey,
		httpClient:     &http.Client{Timeout: 60 * time.Second},
	}
}

// Run blocks and processes jobs from the embedding queue until ctx is done.
func (w *EmbedWorker) Run(ctx context.Context) {
	log.Println("[EmbedWorker] started, listening on", w.embeddingQueue)
	for {
		select {
		case <-ctx.Done():
			log.Println("[EmbedWorker] shutting down")
			return
		default:
		}

		raw, err := w.q.BLPop(ctx, 5*time.Second, w.embeddingQueue)
		if err != nil {
			continue
		}

		var job model.EmbedJob
		if err := json.Unmarshal([]byte(raw), &job); err != nil {
			log.Printf("[EmbedWorker] unmarshal error: %v", err)
			continue
		}

		if err := w.process(ctx, job); err != nil {
			log.Printf("[EmbedWorker] error chunk_id=%s: %v", job.ChunkID, err)
			w.q.PushDLQ(ctx, w.dlqKey, w.embeddingQueue, raw, err.Error())
		}
	}
}

func (w *EmbedWorker) process(ctx context.Context, job model.EmbedJob) error {
	log.Printf("[EmbedWorker] embedding chunk_id=%s model=%s", job.ChunkID, job.EmbeddingModel)

	// Call AIHub to get the embedding vector.
	vector, err := w.callEmbed(ctx, job.EmbeddingModel, job.Content)
	if err != nil {
		return fmt.Errorf("callEmbed: %w", err)
	}

	dim := len(vector)
	table, ok := embeddingDimTable[dim]
	if !ok {
		return fmt.Errorf("unsupported embedding dimension %d from model %s", dim, job.EmbeddingModel)
	}

	// Insert into the dimension-specific table using pgvector literal syntax.
	now := time.Now().UTC()
	_, err = w.db.Exec(ctx,
		fmt.Sprintf(`
			INSERT INTO %s (id, tenant_id, workspace_id, chunk_id, datasource_id, embedding, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8)
			ON CONFLICT (id) DO NOTHING`, table),
		uuid.New().String(),
		job.TenantID,
		job.WorkspaceID,
		job.ChunkID,
		job.DatasourceID,
		pgVector(vector),
		now,
		now,
	)
	if err != nil {
		return fmt.Errorf("insert %s chunk_id=%s: %w", table, job.ChunkID, err)
	}

	log.Printf("[EmbedWorker] chunk_id=%s → %s (dim=%d)", job.ChunkID, table, dim)

	// Decrement the per-ingestion counter. When it reaches 0, all chunks for
	// this ingestion have been embedded — mark the ingestion as completed.
	counterKey := fmt.Sprintf("datahub:embed:remaining:%s", job.IngestionID)
	remaining, err := w.q.DecrAndGet(ctx, counterKey)
	if err != nil {
		log.Printf("[EmbedWorker] warn: counter decr ingestion_id=%s: %v", job.IngestionID, err)
	} else if remaining <= 0 {
		w.setIngestionStatus(ctx, job.IngestionID, "completed")
		log.Printf("[EmbedWorker] ingestion_id=%s completed", job.IngestionID)
	}

	return nil
}

func (w *EmbedWorker) setIngestionStatus(ctx context.Context, ingestionID, status string) {
	_, err := w.db.Exec(ctx,
		`UPDATE ingestions SET status = $1, updated_at = $2 WHERE id = $3`,
		status, time.Now().UTC(), ingestionID,
	)
	if err != nil {
		log.Printf("[EmbedWorker] warn: update status ingestion_id=%s status=%s: %v", ingestionID, status, err)
	}
}

type embedRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type embedResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
}

func (w *EmbedWorker) callEmbed(ctx context.Context, modelName, text string) ([]float64, error) {
	body, _ := json.Marshal(embedRequest{Model: modelName, Input: []string{text}})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		w.aihubURL+"/v1/embed", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http POST /v1/embed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("aihub status %d: %s", resp.StatusCode, b)
	}

	var result embedResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode aihub response: %w", err)
	}
	if len(result.Data) == 0 || len(result.Data[0].Embedding) == 0 {
		return nil, fmt.Errorf("empty embedding in aihub response")
	}
	return result.Data[0].Embedding, nil
}

// pgVector formats a float64 slice as a pgvector literal: [1.0,2.0,...].
func pgVector(v []float64) string {
	var buf bytes.Buffer
	buf.WriteByte('[')
	for i, f := range v {
		if i > 0 {
			buf.WriteByte(',')
		}
		fmt.Fprintf(&buf, "%f", f)
	}
	buf.WriteByte(']')
	return buf.String()
}
