package com.agentplatform.iam.api.oauth;

public record TokenResponse(
        String accessToken,
        String tokenType,
        int expiresIn
) {}
