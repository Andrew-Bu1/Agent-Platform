package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class CreateFeatureEntitlementRequest {

    @NotBlank
    private String featureKey;

    private Boolean enabled;

    private String config;
}
