package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"services/datahub/config"
)

func main() {
	// Load configuration (includes common + datahub-specific)
	cfg := config.Load()

	// Setup router
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/health", healthCheckHandler)

	// Root endpoint
	mux.HandleFunc("/", rootHandler)

	// Get port from config or default
	port := cfg.Port
	if port == 0 {
		port = 8080
	}

	addr := fmt.Sprintf(":%d", port)
	log.Printf("Starting datahub server on %s", addr)

	// Start server
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// healthCheckHandler handles health check requests
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := map[string]interface{}{
		"status":  "healthy",
		"service": "datahub",
	}

	json.NewEncoder(w).Encode(response)
}

// rootHandler handles root requests
func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := map[string]interface{}{
		"message": "Welcome to Datahub API",
		"version": "1.0.0",
	}

	json.NewEncoder(w).Encode(response)
}
