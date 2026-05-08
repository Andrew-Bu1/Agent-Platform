package com.agentplatform.iam.api.permission;

import com.agentplatform.iam.entity.Permission;

import java.util.UUID;

public record PermissionDto(
        UUID   id,
        UUID   tenantId,
        String key,
        String resource,
        String action,
        String description,
        boolean isSystem
) {
    public static PermissionDto from(Permission p) {
        return new PermissionDto(
                p.getId(), p.getTenantId(), p.getKey(), p.getResource(),
                p.getAction(), p.getDescription(), p.isSystem());
    }
}
