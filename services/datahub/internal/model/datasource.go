package model

import (
	"time"

	"github.com/google/uuid"
)

type Datasource struct {
	ID              uuid.UUID  `db:"id"`
	TenantID        uuid.UUID  `db:"tenant_id"`
	WorkspaceID     uuid.UUID  `db:"workspace_id"`
	Name            string     `db:"name"`
	Description     *string    `db:"description"`
	Status          string     `db:"status"`
	CreatedByUserID *uuid.UUID `db:"created_by_user_id"`
	CreatedAt       time.Time  `db:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at"`
}

type CreateDatasourceRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

type UpdateDatasourceRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

type DatasourceResponse struct {
	ID              uuid.UUID  `json:"id"`
	TenantID        uuid.UUID  `json:"tenant_id"`
	WorkspaceID     uuid.UUID  `json:"workspace_id"`
	Name            string     `json:"name"`
	Description     *string    `json:"description,omitempty"`
	Status          string     `json:"status"`
	CreatedByUserID *uuid.UUID `json:"created_by_user_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (d *Datasource) ToResponse() DatasourceResponse {
	return DatasourceResponse{
		ID:              d.ID,
		TenantID:        d.TenantID,
		WorkspaceID:     d.WorkspaceID,
		Name:            d.Name,
		Description:     d.Description,
		Status:          d.Status,
		CreatedByUserID: d.CreatedByUserID,
		CreatedAt:       d.CreatedAt,
		UpdatedAt:       d.UpdatedAt,
	}
}
