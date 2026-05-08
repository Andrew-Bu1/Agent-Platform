package auth

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

type contextKey string

const (
	tenantIDKey    contextKey = "tenant_id"
	workspaceIDKey contextKey = "workspace_id"
)

// Middleware reads X-Tenant-ID and X-Workspace-ID headers (forwarded by
// agent-studio after JWT verification) and injects them into the request
// context. Requests missing either header receive 401.
// Paths listed in exemptPaths are allowed through without headers.
func Middleware(next http.Handler, exemptPaths ...string) http.Handler {
	exempt := make(map[string]struct{}, len(exemptPaths))
	for _, p := range exemptPaths {
		exempt[p] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := exempt[r.URL.Path]; ok {
			next.ServeHTTP(w, r)
			return
		}

		tenantIDStr := r.Header.Get("X-Tenant-ID")
		workspaceIDStr := r.Header.Get("X-Workspace-ID")

		if tenantIDStr == "" || workspaceIDStr == "" {
			http.Error(w, `{"error":"missing X-Tenant-ID or X-Workspace-ID header"}`, http.StatusUnauthorized)
			return
		}

		tenantID, err := uuid.Parse(tenantIDStr)
		if err != nil {
			http.Error(w, `{"error":"invalid X-Tenant-ID"}`, http.StatusBadRequest)
			return
		}

		workspaceID, err := uuid.Parse(workspaceIDStr)
		if err != nil {
			http.Error(w, `{"error":"invalid X-Workspace-ID"}`, http.StatusBadRequest)
			return
		}

		ctx := context.WithValue(r.Context(), tenantIDKey, tenantID)
		ctx = context.WithValue(ctx, workspaceIDKey, workspaceID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// TenantID extracts the tenant UUID from ctx. Panics if not present (should
// only be called after Middleware has run).
func TenantID(ctx context.Context) uuid.UUID {
	return ctx.Value(tenantIDKey).(uuid.UUID)
}

// WorkspaceID extracts the workspace UUID from ctx.
func WorkspaceID(ctx context.Context) uuid.UUID {
	return ctx.Value(workspaceIDKey).(uuid.UUID)
}
