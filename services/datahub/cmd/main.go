// @title           DataHub API
// @version         1.0
// @description     DataHub manages datasources, documents, ingestions, and chunks.
// @BasePath        /

package main

import (
	"context"
	"fmt"
	"libs/go/common/storage"
	"log"
	"net/http"

	_ "services/datahub/docs"
	"services/datahub/internal/config"
	"services/datahub/internal/handler"
	"services/datahub/internal/queue"
	"services/datahub/internal/repository"
	"services/datahub/internal/service"

	"github.com/joho/godotenv"
	httpSwagger "github.com/swaggo/http-swagger"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading from environment")
	}
	cfg := config.Load()

	ctx := context.Background()
	pool, err := repository.NewPool(ctx, cfg.Postgres)
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pool.Close()
	log.Println("connected to postgres")

	// Repositories
	datasourceRepo := repository.NewDatasourceRepository(pool)
	documentRepo := repository.NewDocumentRepository(pool)
	ingestionRepo := repository.NewIngestionRepository(pool)
	chunkRepo := repository.NewChunkRepository(pool)

	// MinIO storage
	minioStorage, err := storage.NewMinioStorage(cfg.Minio)
	if err != nil {
		log.Fatalf("failed to connect to minio: %v", err)
	}
	if err := minioStorage.EnsureBucket(ctx); err != nil {
		log.Fatalf("failed to ensure minio bucket: %v", err)
	}
	log.Println("connected to minio")

	// Redis queue
	redisQueue := queue.NewRedisQueue(cfg.Redis, cfg.IngestionQueue)
	defer redisQueue.Close()
	log.Println("redis queue ready")

	// Services
	datasourceSvc := service.NewDatasourceService(datasourceRepo)
	documentSvc := service.NewDocumentService(documentRepo, minioStorage)
	ingestionSvc := service.NewIngestionService(ingestionRepo, documentRepo, redisQueue)
	chunkSvc := service.NewChunkService(chunkRepo)

	// Handlers
	datasourceHandler := handler.NewDatasourceHandler(datasourceSvc)
	documentHandler := handler.NewDocumentHandler(documentSvc)
	ingestionHandler := handler.NewIngestionHandler(ingestionSvc)
	chunkHandler := handler.NewChunkHandler(chunkSvc)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
	})

	datasourceHandler.RegisterRoutes(mux)
	documentHandler.RegisterRoutes(mux)
	ingestionHandler.RegisterRoutes(mux)
	chunkHandler.RegisterRoutes(mux)

	mux.Handle("/swagger/", httpSwagger.WrapHandler)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("datahub starting on %s", addr)

	if err := http.ListenAndServe(addr, handler.LoggingMiddleware(mux)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
