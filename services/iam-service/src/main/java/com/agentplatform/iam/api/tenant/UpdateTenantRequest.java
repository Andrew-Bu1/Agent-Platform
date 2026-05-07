package com.agentplatform.iam.api.tenant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request body for PATCH /tenants/{tenantId}. */
public record UpdateTenantRequest(
        @NotBlank @Size(max = 255) String name
) {}
