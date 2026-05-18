package service

import (
	"context"
	"errors"
	"fmt"

	"services/datahub/internal/model"
	"services/datahub/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrInvalidVector        = errors.New("vector must not be empty")
	ErrDatasourceNotFound   = errors.New("datasource not found")
	ErrUnsupportedDimension = errors.New("unsupported vector dimension")
)

// DefaultTopK is the fallback result count when the caller does not specify top_k.
const DefaultTopK = 10

// defaultTopK alias kept for internal use.
const defaultTopK = DefaultTopK

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
		return nil, ErrInvalidVector
	}
	topK := req.TopK
	if topK <= 0 {
		topK = defaultTopK
	}

	// Verify datasource belongs to tenant/workspace.
	if _, err := s.datasourceRepo.GetByID(ctx, datasourceID, tenantID, workspaceID); err != nil {
		return nil, ErrDatasourceNotFound
	}

	results, err := s.repo.SearchByVector(ctx, datasourceID, tenantID, workspaceID, req.Vector, topK)
	if err != nil {
		if errors.Is(err, repository.ErrUnsupportedDimension) {
			return nil, fmt.Errorf("%w: %w", ErrUnsupportedDimension, err)
		}
		return nil, err
	}
	return results, nil
}
