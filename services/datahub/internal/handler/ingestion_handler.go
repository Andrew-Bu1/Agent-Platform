package handler

import (
	"encoding/json"
	"net/http"

	"services/datahub/internal/auth"
	"services/datahub/internal/model"
	"services/datahub/internal/service"

	"github.com/google/uuid"
)


const (
	ChunkStrategySemanticChunking = "semantic_chunking"
	ChunkStrategyFixedSize        = "fixed_size"
	ChunkStrategyRecursiveSplit   = "recursive_split"
)

type IngestionHandler struct {
	svc          *service.IngestionService
	featureGuard *auth.FeatureGuard
}

func NewIngestionHandler(svc *service.IngestionService, fg *auth.FeatureGuard) *IngestionHandler {
	return &IngestionHandler{svc: svc, featureGuard: fg}
}

func (h *IngestionHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /documents/{document_id}/ingestions", h.Create)
	mux.HandleFunc("GET /documents/{document_id}/ingestions", h.ListByDocument)
	mux.HandleFunc("GET /ingestions/{id}", h.GetByID)
	mux.HandleFunc("POST /ingestions/{id}/embed", h.TriggerEmbed)
	mux.HandleFunc("DELETE /ingestions/{id}", h.Delete)
}

// Create godoc
// @Summary      Create and trigger an ingestion
// @Description  Creates an ingestion record with status "pending" and publishes an IngestionJob to the ingestion queue.
// @Tags         ingestions
// @Accept       json
// @Produce      json
// @Param        document_id  path      string                        true  "Document ID"
// @Param        body         body      model.CreateIngestionRequest  true  "Ingestion config"
// @Success      202          {object}  model.IngestionResponse
// @Failure      400          {object}  map[string]string
// @Failure      500          {object}  map[string]string
// @Router       /documents/{document_id}/ingestions [post]
func (h *IngestionHandler) Create(w http.ResponseWriter, r *http.Request) {
	if !auth.HasPermission(r.Context(), "datasource:ingest") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID := auth.TenantID(r.Context())
	if err := h.featureGuard.Require(r.Context(), bearerToken(r), tenantID, "datahub.ingestion"); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	documentID, err := uuid.Parse(r.PathValue("document_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document_id")
		return
	}

	var req model.CreateIngestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	
	if req.ChunkStrategy == "" {
		writeError(w, http.StatusBadRequest, "chunk_strategy is required")
		return
	}

	if req.ChunkStrategy != ChunkStrategySemanticChunking &&
		req.ChunkStrategy != ChunkStrategyFixedSize &&
		req.ChunkStrategy != ChunkStrategyRecursiveSplit {
		writeError(w, http.StatusBadRequest, "invalid chunk_strategy")
		return
	}

	mode := req.Mode
	if mode == "" {
		mode = "full_pipeline"
	}
	if mode != "full_pipeline" && mode != "chunk_only" {
		writeError(w, http.StatusBadRequest, "invalid mode: must be 'full_pipeline' or 'chunk_only'")
		return
	}
	req.Mode = mode

	// embedding_model is required for full_pipeline, optional for chunk_only.
	if mode == "full_pipeline" && req.EmbeddingModel == "" {
		writeError(w, http.StatusBadRequest, "embedding_model is required for full_pipeline mode")
		return
	}

	var chunkConfig json.RawMessage
	if req.ChunkConfig != nil {
		chunkConfig, err = json.Marshal(req.ChunkConfig)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid chunk_config")
			return
		}
	}
	

	resp, err := h.svc.Create(r.Context(), req, documentID, chunkConfig, auth.TenantID(r.Context()), auth.WorkspaceID(r.Context()))
	if err != nil {
		writeInternalError(w, "failed to create ingestion", err)
		return
	}

	writeJSON(w, http.StatusAccepted, resp)
}

// ListByDocument godoc
// @Summary      List ingestions for a document
// @Tags         ingestions
// @Produce      json
// @Param        document_id  path      string  true  "Document ID"
// @Success      200          {array}   model.IngestionResponse
// @Failure      400          {object}  map[string]string
// @Failure      500          {object}  map[string]string
// @Router       /documents/{document_id}/ingestions [get]
func (h *IngestionHandler) ListByDocument(w http.ResponseWriter, r *http.Request) {
	documentID, err := uuid.Parse(r.PathValue("document_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document_id")
		return
	}

	ingestions, err := h.svc.GetByDocumentID(r.Context(), documentID, auth.TenantID(r.Context()), auth.WorkspaceID(r.Context()))
	if err != nil {
		writeInternalError(w, "failed to retrieve ingestions", err)
		return
	}

	writeJSON(w, http.StatusOK, ingestions)
}

// GetByID godoc
// @Summary      Get an ingestion by ID
// @Tags         ingestions
// @Produce      json
// @Param        id  path      string  true  "Ingestion ID"
// @Success      200  {object}  model.IngestionResponse
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /ingestions/{id} [get]
func (h *IngestionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	ing, err := h.svc.GetByID(r.Context(), id, auth.TenantID(r.Context()), auth.WorkspaceID(r.Context()))
	if err != nil {
		writeError(w, http.StatusNotFound, "ingestion not found")
		return
	}

	writeJSON(w, http.StatusOK, ing)
}

// TriggerEmbed godoc
// @Summary      Trigger embedding for a chunked ingestion
// @Description  Fetches all chunks for an ingestion with status "chunked" and pushes EmbedJobs to the embedding queue.
// @Tags         ingestions
// @Accept       json
// @Produce      json
// @Param        id    path      string                        true  "Ingestion ID"
// @Param        body  body      model.TriggerEmbedRequest     true  "Embedding config"
// @Success      202   {object}  model.IngestionResponse
// @Failure      400   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /ingestions/{id}/embed [post]
func (h *IngestionHandler) TriggerEmbed(w http.ResponseWriter, r *http.Request) {
	if !auth.HasPermission(r.Context(), "datasource:ingest") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID := auth.TenantID(r.Context())
	if err := h.featureGuard.Require(r.Context(), bearerToken(r), tenantID, "datahub.ingestion"); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req model.TriggerEmbedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.EmbeddingModel == "" {
		writeError(w, http.StatusBadRequest, "embedding_model is required")
		return
	}

	resp, err := h.svc.TriggerEmbed(r.Context(), id, req.EmbeddingModel, auth.TenantID(r.Context()), auth.WorkspaceID(r.Context()))
	if err != nil {
		if err.Error() != "" && len(err.Error()) > 0 {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeInternalError(w, "failed to trigger embedding", err)
		return
	}

	writeJSON(w, http.StatusAccepted, resp)
}

// Delete godoc
// @Summary      Delete an ingestion
// @Tags         ingestions
// @Param        id  path  string  true  "Ingestion ID"
// @Success      204
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /ingestions/{id} [delete]
func (h *IngestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !auth.HasPermission(r.Context(), "datasource:ingest") {
		writeError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID := auth.TenantID(r.Context())
	if err := h.featureGuard.Require(r.Context(), bearerToken(r), tenantID, "datahub.ingestion"); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.svc.Delete(r.Context(), id, auth.TenantID(r.Context()), auth.WorkspaceID(r.Context())); err != nil {
		writeInternalError(w, "failed to delete ingestion", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
