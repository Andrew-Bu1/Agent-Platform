package com.agentplatform.access.repository;

import com.agentplatform.access.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId")
    Page<AuditLog> findByTenantId(@Param("tenantId") UUID tenantId, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.actorId = :actorId")
    Page<AuditLog> findByActorId(@Param("actorId") String actorId, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId AND a.actorId = :actorId AND a.action = :action AND a.resourceType = :resourceType AND a.decision = :decision")
    Page<AuditLog> searchAll(@Param("tenantId") UUID tenantId, @Param("actorId") String actorId, @Param("action") String action, @Param("resourceType") String resourceType, @Param("decision") String decision, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId AND a.actorId = :actorId AND a.action = :action AND a.resourceType = :resourceType")
    Page<AuditLog> searchByTenantActorActionResource(@Param("tenantId") UUID tenantId, @Param("actorId") String actorId, @Param("action") String action, @Param("resourceType") String resourceType, Pageable pageable);
}
