package com.agentplatform.iam.api.feature;

import jakarta.validation.constraints.NotBlank;

public record CreateFeatureRequest(
        @NotBlank String key,
        @NotBlank String name,
        String description
) {}
