package com.agentplatform.access.repository;

import com.agentplatform.access.entity.ApiKey;
import com.agentplatform.access.entity.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

    Page<ApiKey> findByTenant(Tenant tenant, Pageable pageable);

    Optional<ApiKey> findByKeyHash(String keyHash);

    boolean existsByKeyHash(String keyHash);

    @Query("SELECT k FROM ApiKey k WHERE k.tenant = :tenant AND k.status = :status")
    Page<ApiKey> findByTenantAndStatus(@Param("tenant") Tenant tenant,
                                       @Param("status") String status,
                                       Pageable pageable);

    @Query("SELECT k FROM ApiKey k WHERE k.tenant = :tenant AND " +
           "LOWER(k.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<ApiKey> searchByTenant(@Param("tenant") Tenant tenant,
                                @Param("search") String search,
                                Pageable pageable);
}
