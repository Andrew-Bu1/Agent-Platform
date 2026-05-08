package com.agentplatform.iam.api.entitlement;

public record UpdateModelEntitlementRequest(
        Boolean allowed,
        Integer rpmLimit,
        Integer tpmLimit,
        Long dailyTokenLimit,
        Long monthlyTokenLimit,
        String config
) {}
