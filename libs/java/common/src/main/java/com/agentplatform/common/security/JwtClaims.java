package com.agentplatform.common.security;

import java.util.List;
import java.util.Map;

/**
 * Immutable value object representing the claims to embed in a JWT.
 *
 * @param subject      JWT {@code sub} — user UUID or service_client UUID
 * @param audiences    JWT {@code aud} list
 * @param customClaims Additional private claims (tenant_id, workspace_id, scope, etc.)
 */
public record JwtClaims(
        String subject,
        List<String> audiences,
        Map<String, Object> customClaims
) {
    public JwtClaims {
        audiences    = audiences    != null ? List.copyOf(audiences)    : List.of();
        customClaims = customClaims != null ? Map.copyOf(customClaims)  : Map.of();
    }

    /** Convenience factory for the common case of a single audience. */
    public static JwtClaims of(String subject, String audience, Map<String, Object> customClaims) {
        return new JwtClaims(subject, List.of(audience), customClaims);
    }
}
