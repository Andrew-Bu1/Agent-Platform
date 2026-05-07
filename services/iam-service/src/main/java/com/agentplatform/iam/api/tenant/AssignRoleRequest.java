package com.agentplatform.iam.api.tenant;

import jakarta.validation.constraints.NotBlank;

public record AssignRoleRequest(
        @NotBlank String roleKey
) {}
