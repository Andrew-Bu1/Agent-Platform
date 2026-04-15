package com.agentplatform.agentstudio.repository;

import com.agentplatform.agentstudio.entity.Tool;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ToolRepository extends JpaRepository<Tool, UUID> {

    Page<Tool> findByTenantId(UUID tenantId, Pageable pageable);

    @Query("SELECT t FROM Tool t WHERE t.tenantId = :tenantId AND " +
           "(LOWER(t.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(t.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Tool> searchByTenantId(@Param("tenantId") UUID tenantId,
                                 @Param("search") String search,
                                 Pageable pageable);
}
