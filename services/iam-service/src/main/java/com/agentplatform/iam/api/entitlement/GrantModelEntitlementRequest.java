package com.agentplatform.iam.api.entitlement;

import jakarta.validation.constraints.NotBlank;

public record GrantModelEntitlementRequest(
        @NotBlank String modelKey,
        @NotBlank String operationType,
        Boolean allowed,
        Integer rpmLimit,
        Integer tpmLimit,
        Long dailyTokenLimit,
        Long monthlyTokenLimit,
        String config
) {}
