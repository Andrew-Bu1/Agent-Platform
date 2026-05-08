package service

import (
	"context"
	"fmt"

	"services/datahub/internal/model"
	"services/datahub/internal/repository"

	"github.com/google/uuid"
)

const defaultTopK = 10

type SearchService struct {
	repo           *repository.SearchRepository
	datasourceRepo *repository.DatasourceRepository
}

func NewSearchService(repo *repository.SearchRepository, datasourceRepo *repository.DatasourceRepository) *SearchService {
	return &SearchService{repo: repo, datasourceRepo: datasourceRepo}
}

func (s *SearchService) Search(
	ctx context.Context,
	datasourceID, tenantID, workspaceID uuid.UUID,
	req model.VectorSearchRequest,
) ([]*model.VectorSearchResult, error) {
	if len(req.Vector) == 0 {
		return nil, fmt.Errorf("vector must not be empty")
	}
	topK := req.TopK
	if topK <= 0 {
		topK = defaultTopK
	}

	// Verify datasource belongs to tenant/workspace.
	if _, err := s.datasourceRepo.GetByID(ctx, datasourceID, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("datasource not found: %w", err)
	}

	return s.repo.SearchByVector(ctx, datasourceID, tenantID, workspaceID, req.Vector, topK)
}
