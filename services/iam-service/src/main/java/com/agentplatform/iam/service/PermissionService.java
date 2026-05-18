package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.iam.entity.Permission;
import com.agentplatform.iam.repository.FeatureEntitlementRepository;
import com.agentplatform.iam.repository.FeatureRepository;
import com.agentplatform.iam.repository.PermissionRepository;
import com.agentplatform.iam.repository.RolePermissionRepository;
import com.agentplatform.iam.repository.ServiceClientPermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PermissionService {

    private final PermissionRepository              permissionRepo;
    private final RolePermissionRepository          rolePermissionRepo;
    private final ServiceClientPermissionRepository serviceClientPermissionRepo;
    private final FeatureEntitlementRepository      featureEntitlementRepo;
    private final FeatureRepository                 featureRepo;
    private final TenantService                     tenantService;

    // ── JWT helpers (used by AuthService / OauthService) ─────────────────────

    @Transactional(readOnly = true)
    public List<String> collectUserPermissions(UUID userId, UUID tenantId, UUID workspaceId) {
        List<String> permissions = new ArrayList<>(workspaceId != null
                ? permissionRepo.findUserPermissions(userId, tenantId, workspaceId)
                : permissionRepo.findTenantPermissions(userId, tenantId));
        permissions.addAll(enabledFeatureKeys(tenantId));
        return permissions;
    }

    @Transactional(readOnly = true)
    public List<String> collectServiceClientPermissions(String clientId, UUID tenantId) {
        List<String> permissions = new ArrayList<>(permissionRepo.findServiceClientPermissions(clientId));
        if (tenantId != null) {
            permissions.addAll(enabledFeatureKeys(tenantId));
        }
        return permissions;
    }

    /** Returns the feature keys that are currently enabled for the given tenant. */
    private List<String> enabledFeatureKeys(UUID tenantId) {
        var entitlements = featureEntitlementRepo.findEnabledByTenantId(tenantId);
        if (entitlements.isEmpty()) return List.of();
        var featureIds = entitlements.stream()
                .map(e -> e.getFeatureId()).toList();
        return featureRepo.findAllById(featureIds).stream()
                .map(f -> f.getKey())
                .toList();
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    /** Returns platform permissions (tenant_id IS NULL) plus the given tenant's own permissions. */
    @Transactional(readOnly = true)
    public List<Permission> listPermissions(UUID tenantId) {
        return permissionRepo.findVisibleToTenant(tenantId);
    }

    /**
     * Returns all permissions visible to a given tenant as seen by a platform administrator.
     * <p>
     * Includes platform-level system permissions ({@code tenant_id IS NULL}) and any
     * tenant-specific custom permissions. This is a read-only cross-tenant view — the
     * caller must not be a member of {@code tenantId}.
     *
     * @param adminUserId the ID of the calling user — must have a {@code platform_admin} role
     * @param tenantId    the tenant whose permissions are being inspected
     * @throws ForbiddenException if the caller is not a platform administrator
     */
    @Transactional(readOnly = true)
    public List<Permission> listPermissionsForPlatformAdmin(UUID adminUserId, UUID tenantId) {
        tenantService.requirePlatformAdmin(adminUserId);
        return permissionRepo.findVisibleToTenant(tenantId);
    }

    /** Returns the permission only if it is platform-level or belongs to this tenant. */
    @Transactional(readOnly = true)
    public Permission getPermission(UUID id, UUID tenantId) {
        Permission p = permissionRepo.findById(id)
                .orElseThrow(() -> new NotFoundException(ErrorCode.PERMISSION_NOT_FOUND,
                        "Permission not found: " + id));
        if (p.getTenantId() != null && !p.getTenantId().equals(tenantId)) {
            throw new NotFoundException(ErrorCode.PERMISSION_NOT_FOUND,
                    "Permission not found: " + id);
        }
        return p;
    }

    /**
     * Creates a tenant-scoped custom permission.
     * key and resource+action must be unique within the tenant's visible namespace
     * (platform-level AND tenant-level keys are checked to avoid shadowing).
     */
    @Transactional
    public Permission createPermission(UUID userId, UUID tenantId,
                                       String key, String resource, String action, String description) {
        tenantService.requireTenantAdmin(userId, tenantId);

        if (permissionRepo.existsByKeyAndTenantIdIsNull(key) || permissionRepo.existsByKeyAndTenantId(key, tenantId)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Permission key already exists: " + key);
        }
        if (permissionRepo.existsByResourceAndActionAndTenantIdIsNull(resource, action)
                || permissionRepo.existsByResourceAndActionAndTenantId(resource, action, tenantId)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Permission with resource '" + resource + "' and action '" + action + "' already exists");
        }
        Permission p = new Permission();
        p.setId(UUID.randomUUID());
        p.setTenantId(tenantId);
        p.setKey(key);
        p.setResource(resource);
        p.setAction(action);
        p.setDescription(description);
        p.setSystem(false);
        p.setCreatedAt(OffsetDateTime.now());
        return permissionRepo.save(p);
    }

    @Transactional
    public Permission updatePermission(UUID userId, UUID tenantId, UUID id, String description) {
        tenantService.requireTenantAdmin(userId, tenantId);
        Permission p = getPermission(id, tenantId);
        if (p.isSystem()) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "System permissions cannot be modified");
        }
        if (!tenantId.equals(p.getTenantId())) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "Platform permissions cannot be modified by a tenant administrator");
        }
        p.setDescription(description);
        return permissionRepo.save(p);
    }

    @Transactional
    public void deletePermission(UUID userId, UUID tenantId, UUID id) {
        tenantService.requireTenantAdmin(userId, tenantId);
        Permission p = getPermission(id, tenantId);
        if (p.isSystem()) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "System permissions cannot be deleted");
        }
        if (!tenantId.equals(p.getTenantId())) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "Platform permissions cannot be deleted by a tenant administrator");
        }
        if (rolePermissionRepo.existsByIdPermissionId(id)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Permission is still assigned to one or more roles");
        }
        if (serviceClientPermissionRepo.existsByIdPermissionId(id)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Permission is still assigned to one or more service clients");
        }
        permissionRepo.delete(p);
    }
}
