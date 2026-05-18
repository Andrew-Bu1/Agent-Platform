package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os/signal"
	"syscall"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/aihub"
	workerauth "github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/auth"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/config"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/executor"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/queue"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/repository"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/worker"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading from environment")
	}

	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := repository.NewPool(ctx, cfg.Postgres)
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pool.Close()
	log.Println("connected to postgres")

	// Repositories
	agentRepo := repository.NewAgentRepository(pool)
	toolRepo := repository.NewToolRepository(pool)
	messageRepo := repository.NewMessageRepository(pool)
	nodeRunRepo := repository.NewNodeRunRepository(pool)
	humanReviewRepo := repository.NewHumanReviewRepository(pool)

	// AIHub client
	tokenProvider := workerauth.NewOAuthTokenProvider(
		cfg.IamURL,
		cfg.IamOAuthClientID,
		cfg.IamOAuthClientSecret,
	)
	if !tokenProvider.Enabled() {
		log.Println("warning: IAM OAuth credentials not configured; AIHub calls will be unauthenticated")
	}
	aihubClient := aihub.NewClient(cfg.AihubURL, tokenProvider)

	// Queue client (must be before executors — both executors use it as EventPublisher)
	q := queue.NewClient(cfg.Redis, cfg.NodeQueue, cfg.EventQueue, cfg.DLQKey)
	defer q.Close()
	log.Println("redis ready")

	// Executors
	agentExec := executor.NewAgentExecutor(agentRepo, toolRepo, messageRepo, nodeRunRepo, aihubClient, q)
	humanReviewExec := executor.NewHumanReviewExecutor(humanReviewRepo, nodeRunRepo, q)

	// Health endpoint (liveness probe).
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: mux,
	}
	go func() {
		log.Printf("agent-worker health endpoint on :%d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("health server error: %v", err)
		}
	}()

	// Start workers.
	nodeWorker := worker.NewNodeWorker(
		q, cfg.NodeQueue,
		agentExec, humanReviewExec,
		cfg.WorkerCount,
	)

	log.Printf("agent-worker starting %d worker goroutines", cfg.WorkerCount)
	nodeWorker.Start(ctx) // blocks until ctx cancelled

	_ = server.Shutdown(context.Background())
	log.Println("agent-worker stopped")
}
