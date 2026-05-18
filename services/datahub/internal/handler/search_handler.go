package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"services/datahub/internal/auth"
	"services/datahub/internal/model"
	"services/datahub/internal/service"

	"github.com/google/uuid"
)

type SearchHandler struct {
	svc *service.SearchService
}

func NewSearchHandler(svc *service.SearchService) *SearchHandler {
	return &SearchHandler{svc: svc}
}

func (h *SearchHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /datasources/{id}/search", h.Search)
}

// Search godoc
// @Summary      Vector search within a datasource
// @Tags         search
// @Accept       json
// @Produce      json
// @Param        id    path      string                      true  "Datasource ID"
// @Param        body  body      model.VectorSearchRequest   true  "Query vector and top-k"
// @Success      200   {array}   model.VectorSearchResult
// @Failure      400   {object}  map[string]string
// @Failure      404   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /datasources/{id}/search [post]
func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	if !auth.HasPermission(r.Context(), "datahub.search") {
		writeError(w, http.StatusForbidden, "feature not enabled: datahub.search")
		return
	}

	tenantID := auth.TenantID(r.Context())
	workspaceID := auth.WorkspaceID(r.Context())

	datasourceID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid datasource id")
		return
	}

	var req model.VectorSearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	results, err := h.svc.Search(r.Context(), datasourceID, tenantID, workspaceID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidVector), errors.Is(err, service.ErrUnsupportedDimension):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrDatasourceNotFound):
			writeError(w, http.StatusNotFound, err.Error())
		default:
			writeInternalError(w, "search failed", err)
		}
		return
	}

	writeJSON(w, http.StatusOK, results)
}
