package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.iam.entity.Permission;
import com.agentplatform.iam.entity.ServiceClient;
import com.agentplatform.iam.entity.ServiceClientPermission;
import com.agentplatform.iam.entity.ServiceClientPermissionId;
import com.agentplatform.iam.repository.PermissionRepository;
import com.agentplatform.iam.repository.ServiceClientPermissionRepository;
import com.agentplatform.iam.repository.ServiceClientRepository;
import com.agentplatform.iam.security.PasswordHasher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ServiceClientService {

    private final ServiceClientRepository           serviceClientRepo;
    private final ServiceClientPermissionRepository serviceClientPermissionRepo;
    private final PermissionRepository              permissionRepo;
    private final PermissionService                 permissionService;
    private final TenantService                     tenantService;

    /**
     * Returned only on create/rotateSecret — the plain secret is never stored.
     */
    public record ServiceClientCreated(ServiceClient client, String plainSecret) {}

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ServiceClient> listServiceClients(UUID userId, UUID tenantId) {
        tenantService.requireActiveMembership(userId, tenantId);
        return serviceClientRepo.findByTenantId(tenantId);
    }

    @Transactional(readOnly = true)
    public ServiceClient getServiceClient(UUID userId, UUID tenantId, UUID id) {
        tenantService.requireActiveMembership(userId, tenantId);
        return loadAndVerifyOwner(tenantId, id);
    }

    @Transactional(readOnly = true)
    public List<Permission> listPermissions(UUID userId, UUID tenantId, UUID id) {
        tenantService.requireActiveMembership(userId, tenantId);
        loadAndVerifyOwner(tenantId, id);
        List<UUID> permissionIds = serviceClientPermissionRepo.findByIdServiceClientId(id)
                .stream().map(scp -> scp.getId().getPermissionId()).toList();
        return permissionRepo.findAllById(permissionIds);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public ServiceClientCreated createServiceClient(UUID userId, UUID tenantId,
                                                     String clientId, String serviceName,
                                                     String description,
                                                     List<String> allowedAudiences,
                                                     int accessTokenTtlSeconds) {
        tenantService.requireTenantAdmin(userId, tenantId);

        if (serviceClientRepo.existsByClientId(clientId)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "client_id already exists: " + clientId);
        }

        String plainSecret = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");

        ServiceClient sc = new ServiceClient();
        sc.setTenantId(tenantId);
        sc.setClientId(clientId);
        sc.setServiceName(serviceName);
        sc.setSecretHash(PasswordHasher.hash(plainSecret));
        sc.setSecretAlgorithm("bcrypt");
        sc.setDescription(description);
        sc.setAllowedAudiences(allowedAudiences != null ? allowedAudiences : List.of());
        sc.setAccessTokenTtlSeconds(accessTokenTtlSeconds > 0 ? accessTokenTtlSeconds : 3600);
        sc.setActive(true);

        return new ServiceClientCreated(serviceClientRepo.save(sc), plainSecret);
    }

    @Transactional
    public ServiceClient updateServiceClient(UUID userId, UUID tenantId, UUID id,
                                              String serviceName, String description,
                                              List<String> allowedAudiences,
                                              Integer accessTokenTtlSeconds) {
        tenantService.requireTenantAdmin(userId, tenantId);
        ServiceClient sc = loadAndVerifyOwner(tenantId, id);

        if (serviceName != null)         sc.setServiceName(serviceName);
        if (description != null)         sc.setDescription(description);
        if (allowedAudiences != null)    sc.setAllowedAudiences(allowedAudiences);
        if (accessTokenTtlSeconds != null && accessTokenTtlSeconds > 0)
            sc.setAccessTokenTtlSeconds(accessTokenTtlSeconds);

        return serviceClientRepo.save(sc);
    }

    @Transactional
    public ServiceClientCreated rotateSecret(UUID userId, UUID tenantId, UUID id) {
        tenantService.requireTenantAdmin(userId, tenantId);
        ServiceClient sc = loadAndVerifyOwner(tenantId, id);

        String plainSecret = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
        sc.setSecretHash(PasswordHasher.hash(plainSecret));
        sc.setSecretAlgorithm("bcrypt");

        return new ServiceClientCreated(serviceClientRepo.save(sc), plainSecret);
    }

    @Transactional
    public ServiceClient setActive(UUID userId, UUID tenantId, UUID id, boolean active) {
        tenantService.requireTenantAdmin(userId, tenantId);
        ServiceClient sc = loadAndVerifyOwner(tenantId, id);
        sc.setActive(active);
        return serviceClientRepo.save(sc);
    }

    @Transactional
    public void deleteServiceClient(UUID userId, UUID tenantId, UUID id) {
        tenantService.requireTenantAdmin(userId, tenantId);
        ServiceClient sc = loadAndVerifyOwner(tenantId, id);
        serviceClientPermissionRepo.deleteAllByServiceClientId(sc.getId());
        serviceClientRepo.delete(sc);
    }

    @Transactional
    public ServiceClientPermission assignPermission(UUID userId, UUID tenantId,
                                                     UUID id, UUID permissionId) {
        tenantService.requireTenantAdmin(userId, tenantId);
        loadAndVerifyOwner(tenantId, id);

        // Verify the permission is visible to this tenant (platform or tenant-owned).
        permissionService.getPermission(permissionId, tenantId);

        ServiceClientPermissionId pk = new ServiceClientPermissionId(id, permissionId);
        if (serviceClientPermissionRepo.existsById(pk)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Permission is already assigned to this service client");
        }

        ServiceClientPermission scp = new ServiceClientPermission();
        scp.setId(pk);
        return serviceClientPermissionRepo.save(scp);
    }

    @Transactional
    public void revokePermission(UUID userId, UUID tenantId, UUID id, UUID permissionId) {
        tenantService.requireTenantAdmin(userId, tenantId);
        loadAndVerifyOwner(tenantId, id);

        ServiceClientPermissionId pk = new ServiceClientPermissionId(id, permissionId);
        if (!serviceClientPermissionRepo.existsById(pk)) {
            throw new NotFoundException(ErrorCode.NOT_FOUND,
                    "Permission is not assigned to this service client");
        }
        serviceClientPermissionRepo.deleteById(pk);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private ServiceClient loadAndVerifyOwner(UUID tenantId, UUID id) {
        ServiceClient sc = serviceClientRepo.findById(id)
                .orElseThrow(() -> new NotFoundException(ErrorCode.SERVICE_CLIENT_NOT_FOUND,
                        "Service client not found: " + id));
        if (!tenantId.equals(sc.getTenantId())) {
            // Also rejects platform-level clients (tenant_id IS NULL) from tenant-scoped access.
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "Service client does not belong to this tenant");
        }
        return sc;
    }
}
