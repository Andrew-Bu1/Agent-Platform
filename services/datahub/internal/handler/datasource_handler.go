package handler

import (
	"encoding/json"
	"net/http"

	"services/datahub/internal/model"
	"services/datahub/internal/service"

	"github.com/google/uuid"
)

type DatasourceHandler struct {
	svc *service.DatasourceService
}

func NewDatasourceHandler(svc *service.DatasourceService) *DatasourceHandler {
	return &DatasourceHandler{svc: svc}
}

func (h *DatasourceHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /datasources", h.Create)
	mux.HandleFunc("GET /datasources", h.GetAll)
	mux.HandleFunc("GET /datasources/{id}", h.GetByID)
	mux.HandleFunc("PUT /datasources/{id}", h.Update)
	mux.HandleFunc("DELETE /datasources/{id}", h.Delete)
}

// Create godoc
// @Summary      Create a datasource
// @Tags         datasources
// @Accept       json
// @Produce      json
// @Param        body  body      model.CreateDatasourceRequest  true  "Datasource to create"
// @Success      201   {object}  model.DatasourceResponse
// @Failure      400   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /datasources [post]
func (h *DatasourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateDatasourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	resp, err := h.svc.Create(r.Context(), req)
	if err != nil {
		writeInternalError(w, "failed to create datasource", err)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// GetAll godoc
// @Summary      List all datasources
// @Tags         datasources
// @Produce      json
// @Success      200  {array}   model.DatasourceResponse
// @Failure      500  {object}  map[string]string
// @Router       /datasources [get]
func (h *DatasourceHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	datasources, err := h.svc.GetAll(r.Context())
	if err != nil {
		writeInternalError(w, "failed to retrieve datasources", err)
		return
	}

	writeJSON(w, http.StatusOK, datasources)
}

// GetByID godoc
// @Summary      Get a datasource by ID
// @Tags         datasources
// @Produce      json
// @Param        id   path      string  true  "Datasource ID"
// @Success      200  {object}  model.DatasourceResponse
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /datasources/{id} [get]
func (h *DatasourceHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	ds, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "datasource not found")
		return
	}

	writeJSON(w, http.StatusOK, ds)
}

// Update godoc
// @Summary      Update a datasource
// @Tags         datasources
// @Accept       json
// @Produce      json
// @Param        id    path      string                         true  "Datasource ID"
// @Param        body  body      model.UpdateDatasourceRequest  true  "Fields to update"
// @Success      200   {object}  model.DatasourceResponse
// @Failure      400   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /datasources/{id} [put]
func (h *DatasourceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req model.UpdateDatasourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ds, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		writeInternalError(w, "failed to update datasource", err)
		return
	}

	writeJSON(w, http.StatusOK, ds)
}

// Delete godoc
// @Summary      Delete a datasource
// @Tags         datasources
// @Param        id  path  string  true  "Datasource ID"
// @Success      204
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /datasources/{id} [delete]
func (h *DatasourceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeInternalError(w, "failed to delete datasource", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
