package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByKey(String key);
    List<Role> findByIdIn(List<UUID> ids);

    /** Returns platform-level roles (tenant_id IS NULL) plus the given tenant's custom roles. */
    @Query("SELECT r FROM Role r WHERE r.tenantId IS NULL OR r.tenantId = :tenantId ORDER BY r.scopeType, r.key")
    List<Role> findVisibleToTenant(@Param("tenantId") UUID tenantId);

    boolean existsByTenantIdAndKey(UUID tenantId, String key);
}
