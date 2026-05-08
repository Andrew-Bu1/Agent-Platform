package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.ServiceClientPermission;
import com.agentplatform.iam.entity.ServiceClientPermissionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ServiceClientPermissionRepository
        extends JpaRepository<ServiceClientPermission, ServiceClientPermissionId> {

    List<ServiceClientPermission> findByIdServiceClientId(UUID serviceClientId);

    boolean existsByIdPermissionId(UUID permissionId);

    @Modifying
    @Query("DELETE FROM ServiceClientPermission scp WHERE scp.id.serviceClientId = :serviceClientId")
    void deleteAllByServiceClientId(@Param("serviceClientId") UUID serviceClientId);
}
