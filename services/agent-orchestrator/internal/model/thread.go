package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Thread is a conversation/session boundary. A thread may contain multiple runs.
type Thread struct {
	ID           uuid.UUID       `json:"id"`
	TenantID     uuid.UUID       `json:"tenant_id"`
	WorkspaceID  uuid.UUID       `json:"workspace_id"`
	UserID       *uuid.UUID      `json:"user_id,omitempty"`
	Title        *string         `json:"title,omitempty"`
	MetadataJSON json.RawMessage `json:"metadata_json"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// HTTP request / response

type CreateThreadRequest struct {
	Title    *string         `json:"title,omitempty"`
	Metadata json.RawMessage `json:"metadata,omitempty"`
}

type ThreadResponse struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenantId"`
	WorkspaceID uuid.UUID       `json:"workspaceId"`
	UserID      *uuid.UUID      `json:"userId,omitempty"`
	Title       *string         `json:"title,omitempty"`
	Metadata    json.RawMessage `json:"metadata"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

func ThreadToResponse(t *Thread) *ThreadResponse {
	return &ThreadResponse{
		ID:          t.ID,
		TenantID:    t.TenantID,
		WorkspaceID: t.WorkspaceID,
		UserID:      t.UserID,
		Title:       t.Title,
		Metadata:    t.MetadataJSON,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
}
