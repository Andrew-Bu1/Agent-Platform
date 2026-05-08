package com.agentplatform.iam.api.permission;

import jakarta.validation.constraints.NotBlank;

public record CreatePermissionRequest(
        @NotBlank String key,
        @NotBlank String resource,
        @NotBlank String action,
        String description
) {}
