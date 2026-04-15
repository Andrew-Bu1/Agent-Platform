package com.agentplatform.access.repository;

import com.agentplatform.access.entity.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    boolean existsByCode(String code);

    @Query("SELECT t FROM Tenant t WHERE " +
           "LOWER(t.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(t.code) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Tenant> search(@Param("search") String search, Pageable pageable);
}
