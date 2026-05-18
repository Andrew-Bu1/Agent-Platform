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

// HasPermission returns true when the JWT carried the given permission/feature key.
func HasPermission(ctx context.Context, key string) bool {
	return commonauth.HasPermission(ctx, key)
}

// CreatedByUserID returns the caller's user UUID when the token is a user
// token, and nil for service-client tokens.
func CreatedByUserID(ctx context.Context) *uuid.UUID {
	if commonauth.CallerType(ctx) != "user" {
		return nil
	}
	id, err := uuid.Parse(commonauth.Subject(ctx))
	if err != nil {
		return nil
	}
	return &id
}

