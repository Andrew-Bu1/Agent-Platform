package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "data": v})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "BAD_REQUEST", "message": msg})
}

func writeInternalError(w http.ResponseWriter, msg string, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "INTERNAL", "message": msg})
}

func parseUUIDParam(r *http.Request, param string) (uuid.UUID, error) {
	return uuid.Parse(r.PathValue(param))
}
