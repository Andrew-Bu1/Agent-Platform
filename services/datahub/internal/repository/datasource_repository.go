package repository

import (
	"context"
	"fmt"

	"services/datahub/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DatasourceRepository struct {
	db *pgxpool.Pool
}

func NewDatasourceRepository(db *pgxpool.Pool) *DatasourceRepository {
	return &DatasourceRepository{db: db}
}

func (r *DatasourceRepository) Insert(ctx context.Context, d *model.Datasource) error {
	const q = `
		INSERT INTO datasources (id, tenant_id, workspace_id, name, description, created_by_user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	_, err := r.db.Exec(ctx, q,
		d.ID,
		d.TenantID,
		d.WorkspaceID,
		d.Name,
		d.Description,
		d.CreatedByUserID,
		d.CreatedAt,
		d.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("DatasourceRepository.Insert: %w", err)
	}
	return nil
}

func (r *DatasourceRepository) GetByID(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Datasource, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, name, description, created_by_user_id, created_at, updated_at
		FROM datasources
		WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	row := r.db.QueryRow(ctx, q, id, tenantID, workspaceID)

	var d model.Datasource
	if err := row.Scan(
		&d.ID,
		&d.TenantID,
		&d.WorkspaceID,
		&d.Name,
		&d.Description,
		&d.CreatedByUserID,
		&d.CreatedAt,
		&d.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("DatasourceRepository.GetByID: %w", err)
	}
	return &d, nil
}

func (r *DatasourceRepository) GetAll(ctx context.Context, tenantID, workspaceID uuid.UUID) ([]*model.Datasource, error) {
	const q = `
		SELECT id, tenant_id, workspace_id, name, description, created_by_user_id, created_at, updated_at
		FROM datasources
		WHERE tenant_id = $1 AND workspace_id = $2
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, tenantID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("DatasourceRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var datasources []*model.Datasource
	for rows.Next() {
		var d model.Datasource
		if err := rows.Scan(
			&d.ID,
			&d.TenantID,
			&d.WorkspaceID,
			&d.Name,
			&d.Description,
			&d.CreatedByUserID,
			&d.CreatedAt,
			&d.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("DatasourceRepository.GetAll scan: %w", err)
		}
		datasources = append(datasources, &d)
	}
	return datasources, rows.Err()
}

func (r *DatasourceRepository) Update(ctx context.Context, d *model.Datasource) error {
	const q = `
		UPDATE datasources
		SET name = $1, description = $2, updated_at = $3
		WHERE id = $4 AND tenant_id = $5 AND workspace_id = $6`

	_, err := r.db.Exec(ctx, q,
		d.Name,
		d.Description,
		d.UpdatedAt,
		d.ID,
		d.TenantID,
		d.WorkspaceID,
	)
	if err != nil {
		return fmt.Errorf("DatasourceRepository.Update: %w", err)
	}
	return nil
}

func (r *DatasourceRepository) Delete(ctx context.Context, id, tenantID, workspaceID uuid.UUID) error {
	const q = `DELETE FROM datasources WHERE id = $1 AND tenant_id = $2 AND workspace_id = $3`

	_, err := r.db.Exec(ctx, q, id, tenantID, workspaceID)
	if err != nil {
		return fmt.Errorf("DatasourceRepository.Delete: %w", err)
	}
	return nil
}
