package com.agentplatform.common.security;

import java.util.List;

/**
 * Immutable value object representing the authenticated caller after a JWT has been
 * parsed and verified by {@link JwtVerifier}.
 *
 * <p>A JWT filter creates this from the {@link com.nimbusds.jwt.JWTClaimsSet} and stores it
 * as the Spring Security {@code Authentication} principal so every downstream layer can read
 * it without touching raw claim maps.
 *
 * <p>Field rules:
 * <ul>
 *   <li>{@code subject}         — always present (user UUID or service_client UUID)</li>
 *   <li>{@code tenantId}        — present for user tokens; may be null for platform-scoped service clients</li>
 *   <li>{@code workspaceId}     — optional workspace context carried in the token</li>
 *   <li>{@code userId}          — set for human user tokens; null for service client tokens</li>
 *   <li>{@code serviceClientId} — set for machine tokens; null for user tokens</li>
 *   <li>{@code tokenType}       — {@code "access"} or {@code "refresh"}</li>
 *   <li>{@code permissions}     — permission keys granted to this principal (e.g. {@code "agent:run"})</li>
 * </ul>
 *
 * <p>Usage example in a service:
 * <pre>
 * AuthContext auth = (AuthContext) SecurityContextHolder.getContext()
 *                                   .getAuthentication().getPrincipal();
 * auth.tenantId();
 * auth.workspaceId();
 * auth.hasPermission("agent:run");
 * </pre>
 */
public record AuthContext(
        String subject,
        String tenantId,
        String workspaceId,
        String userId,
        String serviceClientId,
        String tokenType,
        List<String> audiences,
        List<String> permissions
) {
    public AuthContext {
        audiences   = audiences   != null ? List.copyOf(audiences)   : List.of();
        permissions = permissions != null ? List.copyOf(permissions) : List.of();
    }

    /** Returns true if this context carries the given permission key. */
    public boolean hasPermission(String permission) {
        return permissions.contains(permission);
    }

    /** True when this token belongs to a human user (not a service client). */
    public boolean isUserToken() {
        return userId != null;
    }

    /** True when this token belongs to a service-to-service client. */
    public boolean isServiceClientToken() {
        return serviceClientId != null;
    }
}
