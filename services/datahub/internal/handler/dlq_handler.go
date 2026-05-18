package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"services/datahub/internal/queue"
)

// DLQHandler exposes admin endpoints for the data-worker dead-letter queue.
// Routes are registered under /ingestions/dlq and are protected by the same
// JWT middleware as all other DataHub endpoints.
type DLQHandler struct {
	q      *queue.RedisQueue
	dlqKey string
}

func NewDLQHandler(q *queue.RedisQueue, dlqKey string) *DLQHandler {
	return &DLQHandler{q: q, dlqKey: dlqKey}
}

func (h *DLQHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /ingestions/dlq", h.List)
	mux.HandleFunc("POST /ingestions/dlq/replay", h.Replay)
	mux.HandleFunc("DELETE /ingestions/dlq", h.Clear)
}

// List returns pending DLQ entries without removing them.
// Query param: limit (default 100, max 1000).
func (h *DLQHandler) List(w http.ResponseWriter, r *http.Request) {
	limit := int64(100)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}

	total, err := h.q.DLQLen(r.Context(), h.dlqKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	entries, err := h.q.DLQList(r.Context(), h.dlqKey, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total":   total,
		"entries": entries,
	})
}

// Replay pushes all DLQ entries back to their original source queues.
func (h *DLQHandler) Replay(w http.ResponseWriter, r *http.Request) {
	replayed, err := h.q.DLQReplay(r.Context(), h.dlqKey)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"replayed": replayed,
			"error":    err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"replayed": replayed})
}

// Clear deletes all entries from the dead-letter queue.
func (h *DLQHandler) Clear(w http.ResponseWriter, r *http.Request) {
	if err := h.q.DLQClear(r.Context(), h.dlqKey); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
