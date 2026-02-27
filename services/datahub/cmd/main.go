// @title           DataHub API
// @version         1.0
// @description     DataHub manages datasources, documents, ingestions, and chunks.
// @host            localhost:8080
// @BasePath        /

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	_ "services/datahub/docs"
	"services/datahub/internal/config"
	"services/datahub/internal/handler"
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
	pool, err := repository.NewPool(ctx, cfg.PostgresConfig())
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

	// Services
	datasourceSvc := service.NewDatasourceService(datasourceRepo)
	documentSvc := service.NewDocumentService(documentRepo)
	ingestionSvc := service.NewIngestionService(ingestionRepo)
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
		fmt.Fprintln(w, `{"status":"ok"}`)
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
