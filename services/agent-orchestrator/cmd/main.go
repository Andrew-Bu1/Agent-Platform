package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"libs/go/common/auth"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/config"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/engine"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/handler"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/queue"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/repository"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/service"

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
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pool.Close()
	log.Println("connected to postgres")

	// Repositories
	runRepo := repository.NewRunRepository(pool)
	nodeRunRepo := repository.NewNodeRunRepository(pool)
	eventRepo := repository.NewRunEventRepository(pool)
	flowVersionRepo := repository.NewFlowVersionRepository(pool)

	// Redis queue
	q := queue.NewClient(cfg.Redis, cfg.NodeQueue, cfg.EventQueue, cfg.DLQKey)
	defer q.Close()
	log.Println("redis ready")

	// Dispatcher — routes NodeResults from Redis to the correct engine.
	dispatcher := engine.NewDispatcher(q, cfg.WorkerCount)
	dispatcher.Start(ctx)
	log.Printf("event dispatcher started (%d workers)", cfg.WorkerCount)

	// Service + handler
	runSvc := service.NewRunService(
		runRepo, nodeRunRepo, eventRepo, flowVersionRepo,
		q, dispatcher, cfg.NodeQueue,
	)
	runHandler := handler.NewRunHandler(runSvc)

	threadRepo := repository.NewThreadRepository(pool)
	threadSvc := service.NewThreadService(threadRepo)
	threadHandler := handler.NewThreadHandler(threadSvc)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	runHandler.RegisterRoutes(mux)
	threadHandler.RegisterRoutes(mux)

	// Auth middleware — exempt /health
	handler := auth.Middleware(mux, "/health")

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("agent-orchestrator listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
