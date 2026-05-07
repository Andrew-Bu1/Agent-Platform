package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.Membership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {

    Optional<Membership> findByUserIdAndTenantIdAndStatus(UUID userId, UUID tenantId, String status);

    List<Membership> findByUserIdAndStatus(UUID userId, String status);

    /** All active memberships in a tenant — used for listing tenant members. */
    List<Membership> findByTenantIdAndStatus(UUID tenantId, String status);

    Optional<Membership> findByUserIdAndTenantId(UUID userId, UUID tenantId);
}
