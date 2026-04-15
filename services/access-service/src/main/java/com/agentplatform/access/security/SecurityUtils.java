package com.agentplatform.access.security;

import com.agentplatform.access.exception.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

public final class SecurityUtils {

    private SecurityUtils() {}

    public static Jwt currentJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return (Jwt) auth.getPrincipal();
    }

    public static UUID currentUserId() {
        return UUID.fromString(currentJwt().getSubject());
    }

    public static UUID currentTenantId() {
        String tenantId = currentJwt().getClaimAsString("tenantId");
        if (tenantId == null) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Tenant claim missing in token");
        }
        return UUID.fromString(tenantId);
    }
}
