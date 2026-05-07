package com.agentplatform.iam.api.tenant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request body for POST /tenants/{tenantId}/workspaces. */
public record CreateWorkspaceRequest(
        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^[a-z0-9-]+$", message = "code must contain only lowercase letters, digits, or hyphens")
        String code,

        @NotBlank @Size(max = 255) String name,

        @Size(max = 1000) String description
) {}
