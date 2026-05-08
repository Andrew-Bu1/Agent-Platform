package com.agentplatform.iam.api.role;

import jakarta.validation.constraints.NotBlank;

public record UpdateRoleRequest(
        @NotBlank String name,
        String description
) {}
