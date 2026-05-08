package com.agentplatform.iam.api.tenant;

import com.agentplatform.iam.entity.Workspace;

import java.util.UUID;

public record WorkspaceDto(UUID id, UUID tenantId, String code, String name, String description, String status) {

    public static WorkspaceDto from(Workspace w) {
        return new WorkspaceDto(w.getId(), w.getTenantId(), w.getCode(), w.getName(), w.getDescription(), w.getStatus());
    }
}
