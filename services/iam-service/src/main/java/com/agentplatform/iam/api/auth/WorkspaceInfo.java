package com.agentplatform.iam.api.auth;

import java.util.UUID;

public record WorkspaceInfo(
        UUID id,
        String code,
        String name,
        String description
) {}
