package com.agentplatform.iam.api.role;

import jakarta.validation.constraints.NotBlank;

public record CreateRoleRequest(
        @NotBlank String key,
        @NotBlank String name,
        String scopeType,
        String description
) {}
