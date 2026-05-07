package com.agentplatform.iam.api.tenant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request body for POST /tenants (authenticated — add another tenant). */
public record CreateTenantRequest(
        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^[a-z0-9-]+$", message = "code must contain only lowercase letters, digits, or hyphens")
        String code,

        @NotBlank @Size(max = 255) String name,

        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^[a-z0-9-]+$", message = "workspaceCode must contain only lowercase letters, digits, or hyphens")
        String workspaceCode,

        @NotBlank @Size(max = 255) String workspaceName
) {}
