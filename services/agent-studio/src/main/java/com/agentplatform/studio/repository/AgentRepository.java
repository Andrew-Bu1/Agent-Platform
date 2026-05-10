package com.agentplatform.studio.repository;

import com.agentplatform.studio.entity.Agent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AgentRepository extends JpaRepository<Agent, UUID> {

    Page<Agent> findByTenantIdAndWorkspaceIdAndStatusNot(UUID tenantId, UUID workspaceId, String status, Pageable pageable);

    Optional<Agent> findByIdAndTenantIdAndWorkspaceId(UUID id, UUID tenantId, UUID workspaceId);

    boolean existsByWorkspaceIdAndName(UUID workspaceId, String name);
}
