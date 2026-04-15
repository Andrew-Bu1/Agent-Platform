package com.agentplatform.access.repository;

import com.agentplatform.access.entity.ModelEntitlement;
import com.agentplatform.access.entity.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ModelEntitlementRepository extends JpaRepository<ModelEntitlement, UUID> {

    List<ModelEntitlement> findByTenant(Tenant tenant);

    Page<ModelEntitlement> findByTenant(Tenant tenant, Pageable pageable);

    Optional<ModelEntitlement> findByTenantAndModelKeyAndOperationType(Tenant tenant, String modelKey, String operationType);

    boolean existsByTenantAndModelKeyAndOperationType(Tenant tenant, String modelKey, String operationType);
}
