package com.agentplatform.access.repository;

import com.agentplatform.access.entity.Permission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    Optional<Permission> findByResourceAndAction(String resource, String action);

    boolean existsByResourceAndAction(String resource, String action);

    @Query("SELECT p FROM Permission p WHERE p.resource = :resource")
    Page<Permission> findByResource(@Param("resource") String resource, Pageable pageable);

    @Query("SELECT p FROM Permission p WHERE " +
           "LOWER(p.resource) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.action) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Permission> search(@Param("search") String search, Pageable pageable);
}
