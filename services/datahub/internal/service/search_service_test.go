package service_test

import (
	"context"
	"errors"
	"testing"

	"services/datahub/internal/model"
	"services/datahub/internal/service"

	"github.com/google/uuid"
)

func zeroUUID() uuid.UUID { return uuid.UUID{} }

// newSearchSvc returns a SearchService with nil repos.
// Safe to call for paths that return before touching any repository.
func newSearchSvc() *service.SearchService {
	return service.NewSearchService(nil, nil)
}

func TestSearch_EmptyVector_ReturnsErrInvalidVector(t *testing.T) {
	svc := newSearchSvc()
	_, err := svc.Search(context.Background(),
		zeroUUID(), zeroUUID(), zeroUUID(),
		model.VectorSearchRequest{Vector: nil},
	)
	if !errors.Is(err, service.ErrInvalidVector) {
		t.Errorf("expected ErrInvalidVector, got %v", err)
	}
}

func TestSearch_EmptySliceVector_ReturnsErrInvalidVector(t *testing.T) {
	svc := newSearchSvc()
	_, err := svc.Search(context.Background(),
		zeroUUID(), zeroUUID(), zeroUUID(),
		model.VectorSearchRequest{Vector: []float64{}},
	)
	if !errors.Is(err, service.ErrInvalidVector) {
		t.Errorf("expected ErrInvalidVector for empty slice, got %v", err)
	}
}

func TestSearch_ErrorConstants_AreDistinct(t *testing.T) {
	// Ensures the sentinel errors are not accidentally the same value.
	if errors.Is(service.ErrInvalidVector, service.ErrDatasourceNotFound) {
		t.Error("ErrInvalidVector and ErrDatasourceNotFound must be distinct")
	}
	if errors.Is(service.ErrInvalidVector, service.ErrUnsupportedDimension) {
		t.Error("ErrInvalidVector and ErrUnsupportedDimension must be distinct")
	}
	if errors.Is(service.ErrDatasourceNotFound, service.ErrUnsupportedDimension) {
		t.Error("ErrDatasourceNotFound and ErrUnsupportedDimension must be distinct")
	}
}

func TestSearch_DefaultTopKValue(t *testing.T) {
	// DefaultTopK must equal 10 — the value documented in the architecture docs
	// (docs/architecture/datahub/sequence.md) and the API spec.
	const wantDefault = 10
	if service.DefaultTopK != wantDefault {
		t.Errorf("expected DefaultTopK=%d, got %d", wantDefault, service.DefaultTopK)
	}
}
