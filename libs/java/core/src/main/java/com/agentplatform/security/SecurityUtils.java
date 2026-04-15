package com.agentplatform.security;

import com.agentplatform.exception.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/**
 * Shared security utilities for extracting JWT claims from the Spring Security context.
 * Works in any service that uses Spring Security OAuth2 Resource Server (HMAC HS256).
 *
 * <p>Claims encoded by access-service:
 * <ul>
 *   <li>{@code sub} — user UUID</li>
 *   <li>{@code tenantId} — tenant UUID</li>
 * </ul>
 */
public final class SecurityUtils {

    private SecurityUtils() {}

    public static Jwt currentJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return jwt;
    }

    public static UUID currentUserId() {
        String subject = currentJwt().getSubject();
        if (subject == null || subject.isBlank()) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "User claim missing in token");
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException e) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Invalid user claim in token");
        }
    }

    public static UUID currentTenantId() {
        String tenantId = currentJwt().getClaimAsString("tenantId");
        if (tenantId == null || tenantId.isBlank()) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Tenant claim missing in token");
        }
        try {
            return UUID.fromString(tenantId);
        } catch (IllegalArgumentException e) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Invalid tenant claim in token");
        }
    }
}
