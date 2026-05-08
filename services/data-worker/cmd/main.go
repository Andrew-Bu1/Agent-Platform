package main

import (
	"context"
	"log"
	"sync"

	"services/data-worker/internal/config"
	"services/data-worker/internal/repository"
	"services/data-worker/internal/worker"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading from environment")
	}

	cfg := config.Load()

	ctx := context.Background()

	pool, err := repository.NewPool(ctx, cfg.Postgres)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()
	log.Println("connected to postgres")

	ingestionWorker, err := worker.NewIngestionWorker(
		cfg.Redis,
		cfg.Minio,
		pool,
		cfg.IngestionQueue,
		cfg.ChunkingQueue,
		cfg.DLQKey,
	)
	if err != nil {
		log.Fatalf("ingestion worker init: %v", err)
	}

	chunkWorker := worker.NewChunkWorker(
		cfg.Redis,
		pool,
		cfg.ChunkingQueue,
		cfg.EmbeddingQueue,
		cfg.DLQKey,
	)

	embedWorker := worker.NewEmbedWorker(
		cfg.Redis,
		pool,
		cfg.EmbeddingQueue,
		cfg.AihubURL,
		cfg.DLQKey,
	)

	var wg sync.WaitGroup
	n := cfg.WorkerConcurrency

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); ingestionWorker.Run(ctx) }()
	}
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); chunkWorker.Run(ctx) }()
	}
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); embedWorker.Run(ctx) }()
	}

	log.Printf("data-worker running — %d ingestion / %d chunk / %d embed goroutines", n, n, n)
	wg.Wait()
	log.Println("data-worker stopped")
}
