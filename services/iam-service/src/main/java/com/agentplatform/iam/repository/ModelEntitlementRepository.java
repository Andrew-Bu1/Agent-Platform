package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.ModelEntitlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ModelEntitlementRepository extends JpaRepository<ModelEntitlement, UUID> {
    List<ModelEntitlement> findByTenantIdAndAllowedTrue(UUID tenantId);

    List<ModelEntitlement> findByTenantId(UUID tenantId);

    Optional<ModelEntitlement> findByTenantIdAndModelKeyAndOperationType(
            UUID tenantId, String modelKey, String operationType);

    boolean existsByTenantIdAndModelKeyAndOperationType(
            UUID tenantId, String modelKey, String operationType);
}
