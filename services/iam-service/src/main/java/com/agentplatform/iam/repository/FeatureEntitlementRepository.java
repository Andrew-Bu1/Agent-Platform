package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.FeatureEntitlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface FeatureEntitlementRepository extends JpaRepository<FeatureEntitlement, UUID> {

    @Query("""
            SELECT fe FROM FeatureEntitlement fe
            JOIN Feature f ON f.id = fe.featureId
            WHERE fe.tenantId = :tenantId AND fe.enabled = true
            """)
    List<FeatureEntitlement> findEnabledByTenantId(@Param("tenantId") UUID tenantId);
}
