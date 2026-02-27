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
		INSERT INTO datasource (id, name, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)`

	_, err := r.db.Exec(ctx, q,
		d.ID,
		d.Name,
		d.Description,
		d.CreatedAt,
		d.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("DatasourceRepository.Insert: %w", err)
	}
	return nil
}

func (r *DatasourceRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Datasource, error) {
	const q = `
		SELECT id, name, description, created_at, updated_at
		FROM datasource
		WHERE id = $1`

	row := r.db.QueryRow(ctx, q, id)

	var d model.Datasource
	if err := row.Scan(
		&d.ID,
		&d.Name,
		&d.Description,
		&d.CreatedAt,
		&d.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("DatasourceRepository.GetByID: %w", err)
	}
	return &d, nil
}

func (r *DatasourceRepository) GetAll(ctx context.Context) ([]*model.Datasource, error) {
	const q = `
		SELECT id, name, description, created_at, updated_at
		FROM datasource
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("DatasourceRepository.GetAll: %w", err)
	}
	defer rows.Close()

	var datasources []*model.Datasource
	for rows.Next() {
		var d model.Datasource
		if err := rows.Scan(
			&d.ID,
			&d.Name,
			&d.Description,
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
		UPDATE datasource
		SET name = $1, description = $2, updated_at = $3
		WHERE id = $4`

	_, err := r.db.Exec(ctx, q,
		d.Name,
		d.Description,
		d.UpdatedAt,
		d.ID,
	)
	if err != nil {
		return fmt.Errorf("DatasourceRepository.Update: %w", err)
	}
	return nil
}

func (r *DatasourceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const q = `DELETE FROM datasource WHERE id = $1`

	_, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("DatasourceRepository.Delete: %w", err)
	}
	return nil
}
