package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"services/datahub/internal/model"
	"services/datahub/internal/service"

	"github.com/google/uuid"
)

type DocumentHandler struct {
	svc *service.DocumentService
}

func NewDocumentHandler(svc *service.DocumentService) *DocumentHandler {
	return &DocumentHandler{svc: svc}
}

func (h *DocumentHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /datasources/{datasource_id}/documents", h.Upload)
	mux.HandleFunc("GET /datasources/{datasource_id}/documents", h.ListByDatasource)
	mux.HandleFunc("GET /documents/{id}", h.GetByID)
	mux.HandleFunc("PUT /documents/{id}", h.Update)
	mux.HandleFunc("DELETE /documents/{id}", h.Delete)
}

// Upload handles multipart/form-data file uploads.
// Form fields:
//   - file     (required) — the file to upload
//   - metadata (optional) — arbitrary JSON
// Upload godoc
// @Summary      Upload a document
// @Tags         documents
// @Accept       multipart/form-data
// @Produce      json
// @Param        datasource_id  path      string  true   "Datasource ID"
// @Param        file           formData  file    true   "File to upload"
// @Param        metadata       formData  string  false  "Optional JSON metadata"
// @Success      201  {object}  model.DocumentResponse
// @Failure      400  {object}  map[string]string
// @Failure      409  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /datasources/{datasource_id}/documents [post]
func (h *DocumentHandler) Upload(w http.ResponseWriter, r *http.Request) {
	datasourceID, err := uuid.Parse(r.PathValue("datasource_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid datasource_id")
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32 MB max memory
		writeError(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	// Read file bytes and compute SHA-256 hash
	data, err := io.ReadAll(file)
	if err != nil {
		writeInternalError(w, "failed to read file", err)
		return
	}
	sum := sha256.Sum256(data)
	fileHash := hex.EncodeToString(sum[:])

	// Parse optional metadata
	var metadata json.RawMessage
	if raw := r.FormValue("metadata"); raw != "" {
		if !json.Valid([]byte(raw)) {
			writeError(w, http.StatusBadRequest, "metadata must be valid JSON")
			return
		}
		metadata = json.RawMessage(raw)
	}

	// Storage path pattern — replace with real Minio upload when storage is wired
	storagePath := fmt.Sprintf("%s/%s", datasourceID, header.Filename)

	req := model.CreateDocumentRequest{
		DatasourceID: datasourceID,
		Metadata:     metadata,
	}

	resp, err := h.svc.Create(r.Context(), req, header.Filename, storagePath, fileHash)
	if err != nil {
		if errors.Is(err, service.ErrDuplicateFile) {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeInternalError(w, "failed to create document", err)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// ListByDatasource godoc
// @Summary      List documents for a datasource
// @Tags         documents
// @Produce      json
// @Param        datasource_id  path      string  true  "Datasource ID"
// @Success      200  {array}   model.DocumentResponse
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /datasources/{datasource_id}/documents [get]
func (h *DocumentHandler) ListByDatasource(w http.ResponseWriter, r *http.Request) {
	datasourceID, err := uuid.Parse(r.PathValue("datasource_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid datasource_id")
		return
	}

	docs, err := h.svc.GetByDatasourceID(r.Context(), datasourceID)
	if err != nil {
		writeInternalError(w, "failed to retrieve documents", err)
		return
	}

	writeJSON(w, http.StatusOK, docs)
}

// GetByID godoc
// @Summary      Get a document by ID
// @Tags         documents
// @Produce      json
// @Param        id  path      string  true  "Document ID"
// @Success      200  {object}  model.DocumentResponse
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /documents/{id} [get]
func (h *DocumentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	doc, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	writeJSON(w, http.StatusOK, doc)
}

// Update godoc
// @Summary      Update a document
// @Tags         documents
// @Accept       json
// @Produce      json
// @Param        id    path      string                        true  "Document ID"
// @Param        body  body      model.UpdateDocumentRequest   true  "Fields to update"
// @Success      200   {object}  model.DocumentResponse
// @Failure      400   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /documents/{id} [put]
func (h *DocumentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req model.UpdateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	doc, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		writeInternalError(w, "failed to update document", err)
		return
	}

	writeJSON(w, http.StatusOK, doc)
}

// Delete godoc
// @Summary      Delete a document
// @Tags         documents
// @Param        id  path  string  true  "Document ID"
// @Success      204
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /documents/{id} [delete]
func (h *DocumentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeInternalError(w, "failed to delete document", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
