package com.agentplatform.iam.api.serviceclient;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record CreateServiceClientRequest(
        @NotBlank String clientId,
        @NotBlank String serviceName,
        String description,
        List<String> allowedAudiences,
        Integer accessTokenTtlSeconds
) {}
