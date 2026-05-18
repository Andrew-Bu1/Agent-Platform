package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"libs/go/common/auth"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/service"
	"github.com/google/uuid"
)

type RunHandler struct {
	svc *service.RunService
}

func NewRunHandler(svc *service.RunService) *RunHandler {
	return &RunHandler{svc: svc}
}

func (h *RunHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /runs", h.List)
	mux.HandleFunc("POST /runs", h.Create)
	mux.HandleFunc("GET /runs/pending-review", h.ListPendingReview)
	mux.HandleFunc("GET /runs/{id}", h.GetByID)
	mux.HandleFunc("POST /runs/{id}/cancel", h.Cancel)
	mux.HandleFunc("GET /runs/{id}/events", h.StreamEvents)
	mux.HandleFunc("POST /runs/{id}/resume", h.ResumeHumanReview)
	mux.HandleFunc("GET /runs/{id}/node-runs", h.ListNodeRuns)
}

// Create creates a new flow run and returns it as JSON.
// POST /runs  {flow_version_id, thread_id?, input}
//
// The engine starts immediately in the background; clients should connect to
// GET /runs/{id}/events to receive the SSE event stream.
func (h *RunHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	var req model.CreateRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.FlowVersionID == uuid.Nil {
		writeError(w, http.StatusBadRequest, "flow_version_id is required")
		return
	}

	run, err := h.svc.CreateRun(r.Context(), req, tenantID, workspaceID)
	if err != nil {
		writeInternalError(w, "failed to create run", err)
		return
	}

	writeJSON(w, http.StatusCreated, run)
}

// GetByID returns the current state of a run.
// GET /runs/{id}
func (h *RunHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	id, err := parseUUIDParam(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid run id")
		return
	}

	resp, err := h.svc.GetByID(r.Context(), id, tenantID, workspaceID)
	if err != nil {
		writeInternalError(w, "failed to get run", err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// Cancel stops an active run.
// POST /runs/{id}/cancel
func (h *RunHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	id, err := parseUUIDParam(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid run id")
		return
	}

	if err := h.svc.Cancel(r.Context(), id, tenantID, workspaceID); err != nil {
		writeInternalError(w, "failed to cancel run", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

// StreamEvents streams run events as SSE for the reconnect path.
// GET /runs/{id}/events
//
// Supports the SSE Last-Event-ID header: structural events since that sequence
// number are replayed from the database, then live events follow.
func (h *RunHandler) StreamEvents(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	id, err := parseUUIDParam(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid run id")
		return
	}

	var fromSeq int64
	if lastID := r.Header.Get("Last-Event-ID"); lastID != "" {
		fromSeq, _ = strconv.ParseInt(lastID, 10, 64)
	}

	eventCh, err := h.svc.WatchRun(r.Context(), id, tenantID, workspaceID, fromSeq)
	if err != nil {
		writeInternalError(w, "run not found", err)
		return
	}

	setSSSEHeaders(w)
	flusher, ok := w.(http.Flusher)
	if !ok {
		return
	}
	flusher.Flush()

	for {
		select {
		case ev, ok := <-eventCh:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, ev.Data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

// ResumeHumanReview resumes a run paused at a human_review node.
// POST /runs/{id}/resume
// Body: {"task_id": "<uuid>", "output": {...}}
func (h *RunHandler) ResumeHumanReview(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	runID, err := parseUUIDParam(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid run id")
		return
	}

	var req struct {
		TaskID uuid.UUID       `json:"task_id"`
		Output json.RawMessage `json:"output"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TaskID == uuid.Nil {
		writeError(w, http.StatusBadRequest, "task_id is required")
		return
	}

	if err := h.svc.ResumeHumanReview(r.Context(), runID, req.TaskID, req.Output, tenantID, workspaceID); err != nil {
		writeInternalError(w, "failed to resume run", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "resumed"})
}

// List returns a paginated list of runs for the workspace.
// GET /runs?page=0&size=20
func (h *RunHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))

	resp, err := h.svc.List(r.Context(), tenantID, workspaceID, page, size)
	if err != nil {
		writeInternalError(w, "failed to list runs", err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// ListPendingReview returns all runs waiting_for_human in the workspace.
// GET /runs/pending-review
func (h *RunHandler) ListPendingReview(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	items, err := h.svc.ListPendingReview(r.Context(), tenantID, workspaceID)
	if err != nil {
		writeInternalError(w, "failed to list pending review runs", err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

// ListNodeRuns returns all node-level execution steps for a run.
// GET /runs/{id}/node-runs
func (h *RunHandler) ListNodeRuns(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	id, err := parseUUIDParam(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid run id")
		return
	}

	items, err := h.svc.ListNodeRuns(r.Context(), id, tenantID, workspaceID)
	if err != nil {
		writeInternalError(w, "failed to list node runs", err)
		return
	}
	if items == nil {
		items = []model.NodeRun{}
	}
	writeJSON(w, http.StatusOK, items)
}

func setSSSEHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
}
