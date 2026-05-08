package com.agentplatform.iam.api.role;

import com.agentplatform.iam.entity.Role;

import java.util.UUID;

public record RoleDto(
        UUID   id,
        UUID   tenantId,
        String key,
        String name,
        String scopeType,
        String description,
        boolean isSystem
) {
    public static RoleDto from(Role r) {
        return new RoleDto(
                r.getId(), r.getTenantId(), r.getKey(),
                r.getName(), r.getScopeType(), r.getDescription(), r.isSystem());
    }
}
