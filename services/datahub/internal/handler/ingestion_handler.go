package handler

import (
	"encoding/json"
	"net/http"

	"services/datahub/internal/model"
	"services/datahub/internal/service"

	"github.com/google/uuid"
)

const (
	ChunkStrategySemanticChunking 	= "semantic_chunking"
	ChunkStrategyFixedSize        	= "fixed_size"
	ChunkStrategyRecursiveSplit		= "recursive_split"
)

type IngestionHandler struct {
	svc *service.IngestionService
}

func NewIngestionHandler(svc *service.IngestionService) *IngestionHandler {
	return &IngestionHandler{svc: svc}
}

func (h *IngestionHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /documents/{document_id}/ingestions", h.Create)
	mux.HandleFunc("GET /documents/{document_id}/ingestions", h.ListByDocument)
	mux.HandleFunc("GET /ingestions/{id}", h.GetByID)
	mux.HandleFunc("DELETE /ingestions/{id}", h.Delete)
}

// Create godoc
// @Summary      Create and trigger an ingestion
// @Description  Creates an ingestion record with status "processing" and immediately enqueues a chunk job.
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
	req.DocumentID = documentID

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
	
	if req.EmbeddingModel == "" {
		writeError(w, http.StatusBadRequest, "embedding_model is required")
		return
	}

	resp, err := h.svc.Create(r.Context(), req)
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

	ingestions, err := h.svc.GetByDocumentID(r.Context(), documentID)
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

	ing, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "ingestion not found")
		return
	}

	writeJSON(w, http.StatusOK, ing)
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
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeInternalError(w, "failed to delete ingestion", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
