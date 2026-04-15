package com.agentplatform.access.repository;

import com.agentplatform.access.entity.Membership;
import com.agentplatform.access.entity.Tenant;
import com.agentplatform.access.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {

    List<Membership> findByUserAndStatus(User user, String status);

    List<Membership> findByUser(User user);

    List<Membership> findByTenant(Tenant tenant);

    Optional<Membership> findByUserAndTenant(User user, Tenant tenant);

    boolean existsByUserAndTenant(User user, Tenant tenant);
}
