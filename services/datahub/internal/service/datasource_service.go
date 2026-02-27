package service

import (
	"context"
	"time"

	"services/datahub/internal/model"
	"services/datahub/internal/repository"

	"github.com/google/uuid"
)

type DatasourceService struct {
	repo *repository.DatasourceRepository
}

func NewDatasourceService(repo *repository.DatasourceRepository) *DatasourceService {
	return &DatasourceService{repo: repo}
}

func (s *DatasourceService) Create(ctx context.Context, req model.CreateDatasourceRequest) (*model.DatasourceResponse, error) {
	now := time.Now().UTC()
	
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	d := &model.Datasource{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Insert(ctx, d); err != nil {
		return nil, err
	}

	resp := d.ToResponse()
	return &resp, nil
}

func (s *DatasourceService) GetByID(ctx context.Context, id uuid.UUID) (*model.DatasourceResponse, error) {
	d, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := d.ToResponse()
	return &resp, nil
}

func (s *DatasourceService) GetAll(ctx context.Context) ([]model.DatasourceResponse, error) {
	datasources, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	responses := make([]model.DatasourceResponse, len(datasources))
	for i, d := range datasources {
		responses[i] = d.ToResponse()
	}
	return responses, nil
}

func (s *DatasourceService) Update(ctx context.Context, id uuid.UUID, req model.UpdateDatasourceRequest) (*model.DatasourceResponse, error) {
	d, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		d.Name = *req.Name
	}
	if req.Description != nil {
		d.Description = req.Description
	}
	d.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, d); err != nil {
		return nil, err
	}

	resp := d.ToResponse()
	return &resp, nil
}

func (s *DatasourceService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
