package handler

import (
	"net/http"

	"services/datahub/internal/service"

	"github.com/google/uuid"
)

type ChunkHandler struct {
	svc *service.ChunkService
}

func NewChunkHandler(svc *service.ChunkService) *ChunkHandler {
	return &ChunkHandler{svc: svc}
}

func (h *ChunkHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /ingestions/{ingestion_id}/chunks", h.ListByIngestion)
	mux.HandleFunc("GET /chunks/{id}", h.GetByID)
}

// ListByIngestion godoc
// @Summary      List chunks for an ingestion
// @Tags         chunks
// @Produce      json
// @Param        ingestion_id  path      string  true  "Ingestion ID"
// @Success      200           {array}   model.ChunkResponse
// @Failure      400           {object}  map[string]string
// @Failure      500           {object}  map[string]string
// @Router       /ingestions/{ingestion_id}/chunks [get]
func (h *ChunkHandler) ListByIngestion(w http.ResponseWriter, r *http.Request) {
	ingestionID, err := uuid.Parse(r.PathValue("ingestion_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ingestion_id")
		return
	}

	chunks, err := h.svc.GetByIngestionID(r.Context(), ingestionID)
	if err != nil {
		writeInternalError(w, "failed to retrieve chunks", err)
		return
	}

	writeJSON(w, http.StatusOK, chunks)
}

// GetByID godoc
// @Summary      Get a chunk by ID
// @Tags         chunks
// @Produce      json
// @Param        id  path      string  true  "Chunk ID"
// @Success      200  {object}  model.ChunkResponse
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /chunks/{id} [get]
func (h *ChunkHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	chunk, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "chunk not found")
		return
	}

	writeJSON(w, http.StatusOK, chunk)
}
