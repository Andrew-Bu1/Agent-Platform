package com.agentplatform.iam.api.tenant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request body for PATCH /tenants/{tenantId}/workspaces/{workspaceId}. */
public record UpdateWorkspaceRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 1000) String description
) {}
