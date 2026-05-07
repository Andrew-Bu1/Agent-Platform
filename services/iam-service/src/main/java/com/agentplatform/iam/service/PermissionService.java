package com.agentplatform.iam.service;

import com.agentplatform.iam.repository.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PermissionService {

    private final PermissionRepository permissionRepo;

    /**
     * Collect all permission keys for a user in the given tenant + workspace context.
     * Uses a single native UNION query — no N+1 loading.
     */
    @Transactional(readOnly = true)
    public List<String> collectUserPermissions(UUID userId, UUID tenantId, UUID workspaceId) {
        if (workspaceId != null) {
            return permissionRepo.findUserPermissions(userId, tenantId, workspaceId);
        }
        return permissionRepo.findTenantPermissions(userId, tenantId);
    }

    /**
     * Collect all permission keys for a service client.
     */
    @Transactional(readOnly = true)
    public List<String> collectServiceClientPermissions(String clientId) {
        return permissionRepo.findServiceClientPermissions(clientId);
    }
}
