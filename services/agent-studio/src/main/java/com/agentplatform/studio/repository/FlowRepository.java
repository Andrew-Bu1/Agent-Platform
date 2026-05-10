package com.agentplatform.studio.repository;

import com.agentplatform.studio.entity.Flow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FlowRepository extends JpaRepository<Flow, UUID> {

    Page<Flow> findByTenantIdAndWorkspaceIdAndStatusNot(UUID tenantId, UUID workspaceId, String status, Pageable pageable);

    Optional<Flow> findByIdAndTenantIdAndWorkspaceId(UUID id, UUID tenantId, UUID workspaceId);

    boolean existsByWorkspaceIdAndName(UUID workspaceId, String name);
}
