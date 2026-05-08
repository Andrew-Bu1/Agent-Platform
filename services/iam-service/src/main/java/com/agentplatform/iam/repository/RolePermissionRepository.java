package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.RolePermission;
import com.agentplatform.iam.entity.RolePermissionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermissionId> {

    List<RolePermission> findByIdRoleId(UUID roleId);

    boolean existsByIdPermissionId(UUID permissionId);

    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.id.roleId = :roleId")
    void deleteAllByRoleId(@Param("roleId") UUID roleId);
}
