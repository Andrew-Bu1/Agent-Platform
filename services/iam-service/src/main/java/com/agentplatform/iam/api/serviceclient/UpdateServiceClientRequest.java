package com.agentplatform.iam.api.serviceclient;

import java.util.List;

public record UpdateServiceClientRequest(
        String serviceName,
        String description,
        List<String> allowedAudiences,
        Integer accessTokenTtlSeconds
) {}
