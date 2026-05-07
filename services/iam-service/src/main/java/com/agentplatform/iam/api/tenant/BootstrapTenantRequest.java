package com.agentplatform.iam.api.tenant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request body for POST /tenants/bootstrap.
 * Used by a freshly registered user who has no tenant yet.
 * The {@code preAuthToken} obtained from POST /auth/login (requireTenantCreation=true)
 * proves the user's identity without a full JWT.
 */
public record BootstrapTenantRequest(
        @NotBlank String preAuthToken,

        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^[a-z0-9-]+$", message = "tenantCode must contain only lowercase letters, digits, or hyphens")
        String tenantCode,

        @NotBlank @Size(max = 255) String tenantName,

        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^[a-z0-9-]+$", message = "workspaceCode must contain only lowercase letters, digits, or hyphens")
        String workspaceCode,

        @NotBlank @Size(max = 255) String workspaceName
) {}
