package com.agentplatform.access.repository;

import com.agentplatform.access.entity.FeatureEntitlement;
import com.agentplatform.access.entity.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FeatureEntitlementRepository extends JpaRepository<FeatureEntitlement, UUID> {

    List<FeatureEntitlement> findByTenant(Tenant tenant);

    Page<FeatureEntitlement> findByTenant(Tenant tenant, Pageable pageable);

    Optional<FeatureEntitlement> findByTenantAndFeatureKey(Tenant tenant, String featureKey);

    boolean existsByTenantAndFeatureKey(Tenant tenant, String featureKey);
}
