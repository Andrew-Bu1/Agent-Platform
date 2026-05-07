package com.agentplatform.iam.api.auth;

import java.util.UUID;

public record MeResponse(
        UUID userId,
        String email,
        String name,
        String avatarUrl,
        String tenantId,
        String workspaceId
) {}
