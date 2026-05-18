package com.agentplatform.iam.api.auth;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SwitchRequest(
        @NotNull UUID tenantId,
        @NotNull UUID workspaceId
) {}
