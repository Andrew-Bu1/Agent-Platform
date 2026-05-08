package com.agentplatform.iam.api.entitlement;

import jakarta.validation.constraints.NotBlank;

public record GrantFeatureRequest(
        @NotBlank String featureKey,
        Boolean enabled,
        String config
) {}
