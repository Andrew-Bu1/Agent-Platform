package com.agentplatform.access.dto;

import lombok.Getter;

@Getter
public class UpdateFeatureEntitlementRequest {

    private Boolean enabled;

    private String config;
}
