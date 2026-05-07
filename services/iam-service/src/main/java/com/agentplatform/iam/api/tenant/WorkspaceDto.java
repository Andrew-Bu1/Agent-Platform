package com.agentplatform.iam.api.tenant;

import java.util.UUID;

public record WorkspaceDto(UUID id, UUID tenantId, String code, String name, String status) {}
