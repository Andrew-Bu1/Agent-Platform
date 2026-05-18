package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.iam.entity.Permission;
import com.agentplatform.iam.entity.Role;
import com.agentplatform.iam.entity.RolePermission;
import com.agentplatform.iam.entity.RolePermissionId;
import com.agentplatform.iam.repository.PermissionRepository;
import com.agentplatform.iam.repository.RolePermissionRepository;
import com.agentplatform.iam.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository           roleRepo;
    private final RolePermissionRepository rolePermissionRepo;
    private final PermissionRepository     permissionRepo;
    private final PermissionService        permissionService;
    private final TenantService            tenantService;

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Role> listRoles(UUID tenantId) {
        return roleRepo.findVisibleToTenant(tenantId);
    }

    /**
     * Returns all roles visible to a given tenant as seen by a platform administrator.
     * <p>
     * Includes platform-level system roles ({@code tenant_id IS NULL}) and any
     * tenant-specific custom roles. This is a read-only cross-tenant view — the
     * caller must not be a member of {@code tenantId}.
     *
     * @param adminUserId the ID of the calling user — must have a {@code platform_admin} role
     * @param tenantId    the tenant whose roles are being inspected
     * @throws ForbiddenException if the caller is not a platform administrator
     */
    @Transactional(readOnly = true)
    public List<Role> listRolesForPlatformAdmin(UUID adminUserId, UUID tenantId) {
        tenantService.requirePlatformAdmin(adminUserId);
        return roleRepo.findVisibleToTenant(tenantId);
    }

    @Transactional(readOnly = true)
    public Role getRole(UUID tenantId, UUID roleId) {
        Role role = loadAndVerifyVisible(tenantId, roleId);
        return role;
    }

    @Transactional(readOnly = true)
    public List<Permission> listRolePermissions(UUID tenantId, UUID roleId) {
        loadAndVerifyVisible(tenantId, roleId);
        List<UUID> permissionIds = rolePermissionRepo.findByIdRoleId(roleId)
                .stream().map(rp -> rp.getId().getPermissionId()).toList();
        return permissionRepo.findAllById(permissionIds);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public Role createRole(UUID userId, UUID tenantId,
                           String key, String name, String scopeType, String description) {
        tenantService.requireTenantAdmin(userId, tenantId);

        if (roleRepo.findVisibleToTenant(tenantId).stream().anyMatch(r -> key.equals(r.getKey()))) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Role key already exists in this tenant: " + key);
        }

        // Tenant-created roles may only be scoped to "tenant" or "workspace".
        String resolvedScope = ("tenant".equals(scopeType)) ? "tenant" : "workspace";

        OffsetDateTime now = OffsetDateTime.now();
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setTenantId(tenantId);
        role.setKey(key);
        role.setName(name);
        role.setScopeType(resolvedScope);
        role.setDescription(description);
        role.setSystem(false);
        role.setCreatedAt(now);
        role.setUpdatedAt(now);
        return roleRepo.save(role);
    }

    @Transactional
    public Role updateRole(UUID userId, UUID tenantId, UUID roleId,
                           String name, String description) {
        tenantService.requireTenantAdmin(userId, tenantId);
        Role role = loadAndVerifyMutable(tenantId, roleId);
        role.setName(name);
        role.setDescription(description);
        role.setUpdatedAt(OffsetDateTime.now());
        return roleRepo.save(role);
    }

    @Transactional
    public void deleteRole(UUID userId, UUID tenantId, UUID roleId) {
        tenantService.requireTenantAdmin(userId, tenantId);
        Role role = loadAndVerifyMutable(tenantId, roleId);
        rolePermissionRepo.deleteAllByRoleId(role.getId());
        roleRepo.delete(role);
    }

    @Transactional
    public RolePermission assignPermission(UUID userId, UUID tenantId,
                                           UUID roleId, UUID permissionId) {
        tenantService.requireTenantAdmin(userId, tenantId);
        loadAndVerifyMutable(tenantId, roleId);

        // Verify the permission is visible to this tenant (platform or tenant-owned).
        permissionService.getPermission(permissionId, tenantId);

        RolePermissionId pk = new RolePermissionId(roleId, permissionId);
        if (rolePermissionRepo.existsById(pk)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Permission is already assigned to this role");
        }

        RolePermission rp = new RolePermission();
        rp.setId(pk);
        return rolePermissionRepo.save(rp);
    }

    @Transactional
    public void revokePermission(UUID userId, UUID tenantId,
                                 UUID roleId, UUID permissionId) {
        tenantService.requireTenantAdmin(userId, tenantId);
        loadAndVerifyMutable(tenantId, roleId);

        RolePermissionId pk = new RolePermissionId(roleId, permissionId);
        if (!rolePermissionRepo.existsById(pk)) {
            throw new NotFoundException(ErrorCode.NOT_FOUND,
                    "Permission is not assigned to this role");
        }
        rolePermissionRepo.deleteById(pk);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Role loadAndVerifyVisible(UUID tenantId, UUID roleId) {
        Role role = roleRepo.findById(roleId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.ROLE_NOT_FOUND,
                        "Role not found: " + roleId));
        // Visible = platform-level role (tenantId IS NULL) or tenant's own role.
        if (role.getTenantId() != null && !tenantId.equals(role.getTenantId())) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "Role does not belong to this tenant");
        }
        return role;
    }

    private Role loadAndVerifyMutable(UUID tenantId, UUID roleId) {
        Role role = loadAndVerifyVisible(tenantId, roleId);
        if (role.isSystem()) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "System roles cannot be modified");
        }
        if (!tenantId.equals(role.getTenantId())) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "Role does not belong to this tenant");
        }
        return role;
    }
}
