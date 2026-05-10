package service

import (
	"context"
	"fmt"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-orchestrator/internal/repository"
	"github.com/google/uuid"
)

type ThreadService struct {
	repo *repository.ThreadRepository
}

func NewThreadService(repo *repository.ThreadRepository) *ThreadService {
	return &ThreadService{repo: repo}
}

func (s *ThreadService) Create(ctx context.Context, req model.CreateThreadRequest, tenantID, workspaceID, userID uuid.UUID) (*model.Thread, error) {
	var uid *uuid.UUID
	if userID != uuid.Nil {
		uid = &userID
	}
	thread := repository.NewThread(tenantID, workspaceID, uid, req.Title, req.Metadata)
	if err := s.repo.Insert(ctx, thread); err != nil {
		return nil, fmt.Errorf("ThreadService.Create: %w", err)
	}
	return thread, nil
}

func (s *ThreadService) Get(ctx context.Context, id, tenantID, workspaceID uuid.UUID) (*model.Thread, error) {
	return s.repo.GetByID(ctx, id, tenantID, workspaceID)
}

func (s *ThreadService) List(ctx context.Context, tenantID, workspaceID uuid.UUID, limit, offset int) ([]*model.Thread, error) {
	return s.repo.ListByWorkspace(ctx, tenantID, workspaceID, limit, offset)
}

func (s *ThreadService) ListRuns(ctx context.Context, threadID, tenantID, workspaceID uuid.UUID, limit, offset int) ([]*model.Run, error) {
	// Verify thread exists and belongs to this tenant/workspace first.
	if _, err := s.repo.GetByID(ctx, threadID, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("thread not found: %w", err)
	}
	return s.repo.ListRunsByThread(ctx, threadID, tenantID, workspaceID, limit, offset)
}

func (s *ThreadService) ListPendingHumanReview(ctx context.Context, tenantID, workspaceID uuid.UUID) ([]*model.Run, error) {
	return s.repo.ListPendingHumanReview(ctx, tenantID, workspaceID)
}
