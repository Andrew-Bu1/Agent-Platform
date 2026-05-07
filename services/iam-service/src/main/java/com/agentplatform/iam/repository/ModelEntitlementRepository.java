package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.ModelEntitlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ModelEntitlementRepository extends JpaRepository<ModelEntitlement, UUID> {
    List<ModelEntitlement> findByTenantIdAndAllowedTrue(UUID tenantId);
}
