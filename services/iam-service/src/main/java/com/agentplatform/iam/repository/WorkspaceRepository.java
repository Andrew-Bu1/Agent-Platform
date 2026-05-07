package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {
    List<Workspace> findByTenantIdAndStatus(UUID tenantId, String status);
    boolean existsByTenantIdAndCode(UUID tenantId, String code);
    Optional<Workspace> findByIdAndTenantId(UUID id, UUID tenantId);
}
