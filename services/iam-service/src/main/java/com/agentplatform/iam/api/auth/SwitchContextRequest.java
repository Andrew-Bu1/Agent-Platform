package com.agentplatform.iam.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SwitchContextRequest(
        @NotBlank String preAuthToken,
        @NotNull UUID tenantId,
        @NotNull UUID workspaceId
) {}
