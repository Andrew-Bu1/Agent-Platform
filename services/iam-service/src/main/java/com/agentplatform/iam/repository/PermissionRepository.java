package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    Optional<Permission> findByKey(String key);

    boolean existsByKey(String key);

    /**
     * Collect all distinct permission keys for a user in a tenant + optional workspace.
     * Single UNION query — no N+1.
     *
     * <p>Tenant-level: user → membership → membership_roles → role_permissions → permissions
     * <p>Workspace-level: user → membership → workspace_membership → workspace_membership_roles
     *                          → role_permissions → permissions
     */
    @Query(nativeQuery = true, value = """
            SELECT DISTINCT p.key
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            JOIN membership_roles mr ON mr.role_id = rp.role_id
            JOIN memberships m ON m.id = mr.membership_id
            WHERE m.user_id = :userId
              AND m.tenant_id = :tenantId
              AND m.status = 'active'
            UNION
            SELECT DISTINCT p.key
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            JOIN workspace_membership_roles wmr ON wmr.role_id = rp.role_id
            JOIN workspace_memberships wm ON wm.id = wmr.workspace_membership_id
            JOIN memberships m ON m.id = wm.membership_id
            WHERE m.user_id = :userId
              AND wm.workspace_id = :workspaceId
              AND wm.status = 'active'
            """)
    List<String> findUserPermissions(@Param("userId") UUID userId,
                                     @Param("tenantId") UUID tenantId,
                                     @Param("workspaceId") UUID workspaceId);

    /**
     * Collect permission keys for a service client.
     */
    @Query(nativeQuery = true, value = """
            SELECT DISTINCT p.key
            FROM permissions p
            JOIN service_client_permissions scp ON scp.permission_id = p.id
            JOIN service_clients sc ON sc.id = scp.service_client_id
            WHERE sc.client_id = :clientId
              AND sc.is_active = true
            """)
    List<String> findServiceClientPermissions(@Param("clientId") String clientId);

    /**
     * Tenant-level permissions only (no workspace context required).
     */
    @Query(nativeQuery = true, value = """
            SELECT DISTINCT p.key
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            JOIN membership_roles mr ON mr.role_id = rp.role_id
            JOIN memberships m ON m.id = mr.membership_id
            WHERE m.user_id = :userId
              AND m.tenant_id = :tenantId
              AND m.status = 'active'
            """)
    List<String> findTenantPermissions(@Param("userId") UUID userId,
                                       @Param("tenantId") UUID tenantId);
}
