package com.agentplatform.agentstudio.repository;

import com.agentplatform.agentstudio.entity.Workflow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface WorkflowRepository extends JpaRepository<Workflow, UUID> {

    Page<Workflow> findByTenantId(UUID tenantId, Pageable pageable);

    @Query("SELECT w FROM Workflow w WHERE w.tenantId = :tenantId AND " +
           "(LOWER(w.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Workflow> searchByTenantId(@Param("tenantId") UUID tenantId,
                                    @Param("search") String search,
                                    Pageable pageable);
}
