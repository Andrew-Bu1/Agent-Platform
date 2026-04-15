package com.agentplatform.agentstudio.repository;

import com.agentplatform.agentstudio.entity.Agent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface AgentRepository extends JpaRepository<Agent, UUID> {

    Page<Agent> findByTenantId(UUID tenantId, Pageable pageable);

    @Query("SELECT a FROM Agent a WHERE a.tenantId = :tenantId AND " +
           "(LOWER(a.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(a.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Agent> searchByTenantId(@Param("tenantId") UUID tenantId,
                                  @Param("search") String search,
                                  Pageable pageable);
}
