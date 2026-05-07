package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    List<Tenant> findByStatus(String status);
    boolean existsByCode(String code);
    Optional<Tenant> findByIdAndStatus(UUID id, String status);
}
