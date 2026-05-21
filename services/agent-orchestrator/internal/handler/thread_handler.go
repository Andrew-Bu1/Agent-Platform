package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"libs/go/common/auth"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/service"
	"github.com/google/uuid"
)

type ThreadHandler struct {
	svc *service.ThreadService
}

func NewThreadHandler(svc *service.ThreadService) *ThreadHandler {
	return &ThreadHandler{svc: svc}
}

func (h *ThreadHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /threads", h.Create)
	mux.HandleFunc("GET /threads", h.List)
	mux.HandleFunc("GET /threads/{id}", h.GetByID)
	mux.HandleFunc("GET /threads/{id}/runs", h.ListRuns)
}

func (h *ThreadHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())
	userID := callerUserID(r.Context())

	if !auth.HasPermission(r.Context(), "flow:run") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req model.CreateThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	thread, err := h.svc.Create(r.Context(), req, tenantID, workspaceID, userID)
	if err != nil {
		writeInternalError(w, "failed to create thread", err)
		return
	}
	writeJSON(w, http.StatusCreated, model.ThreadToResponse(thread))
}

func (h *ThreadHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	if !auth.HasPermission(r.Context(), "flow:run") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}

	id, err := parseUUIDParam(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid thread id")
		return
	}

	thread, err := h.svc.Get(r.Context(), id, tenantID, workspaceID)
	if err != nil {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}
	writeJSON(w, http.StatusOK, model.ThreadToResponse(thread))
}

func (h *ThreadHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())
	limit, offset := parsePagination(r)

	if !auth.HasPermission(r.Context(), "flow:run") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}

	threads, err := h.svc.List(r.Context(), tenantID, workspaceID, limit, offset)
	if err != nil {
		writeInternalError(w, "failed to list threads", err)
		return
	}
	items := make([]*model.ThreadResponse, 0, len(threads))
	for _, t := range threads {
		items = append(items, model.ThreadToResponse(t))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *ThreadHandler) ListRuns(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())
	limit, offset := parsePagination(r)

	if !auth.HasPermission(r.Context(), "flow:run") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}

	id, err := parseUUIDParam(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid thread id")
		return
	}

	runs, err := h.svc.ListRuns(r.Context(), id, tenantID, workspaceID, limit, offset)
	if err != nil {
		writeError(w, http.StatusNotFound, "thread not found or inaccessible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": runs})
}

func (h *ThreadHandler) ListPendingReview(w http.ResponseWriter, r *http.Request) {
	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	if !auth.HasPermission(r.Context(), "flow:run") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}

	runs, err := h.svc.ListPendingHumanReview(r.Context(), tenantID, workspaceID)
	if err != nil {
		writeInternalError(w, "failed to list pending reviews", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": runs})
}

// callerUserID parses the subject claim as a UUID. Returns uuid.Nil for non-user callers.
func callerUserID(ctx context.Context) uuid.UUID {
	sub := auth.Subject(ctx)
	if sub == "" {
		return uuid.Nil
	}
	id, err := uuid.Parse(sub)
	if err != nil {
		return uuid.Nil
	}
	return id
}

func parsePagination(r *http.Request) (limit, offset int) {
	limit = 20
	offset = 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	return
}
