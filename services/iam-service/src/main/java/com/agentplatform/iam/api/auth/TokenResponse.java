package com.agentplatform.iam.api.auth;

import java.util.UUID;

public record TokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UUID userId,
        UUID tenantId,
        UUID workspaceId
) {
    public TokenResponse(String accessToken, String refreshToken, long expiresIn,
                         UUID userId, UUID tenantId, UUID workspaceId) {
        this(accessToken, refreshToken, "Bearer", expiresIn, userId, tenantId, workspaceId);
    }
}
