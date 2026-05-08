package auth

import (
	"context"
	"net/http"

	commonauth "libs/go/common/auth"

	"github.com/google/uuid"
)

// Middleware wraps the shared auth middleware with /health exempt by default.
func Middleware(next http.Handler) http.Handler {
	return commonauth.Middleware(next, "/health")
}

// TenantID extracts the tenant UUID from ctx. Panics if not present (should
// only be called after Middleware has run).
func TenantID(ctx context.Context) uuid.UUID {
	return commonauth.TenantID(ctx)
}

// WorkspaceID extracts the workspace UUID from ctx.
func WorkspaceID(ctx context.Context) uuid.UUID {
	return commonauth.WorkspaceID(ctx)
}

