package com.agentplatform.iam.filter;

import com.agentplatform.common.exception.AppException;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.security.JwtVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Extracts the Bearer token, verifies it, and sets an {@link AuthContext} as the
 * Spring Security principal. Skips the filter if no Bearer token is present
 * (unauthenticated requests are handled by the security config's access rules).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtVerifier jwtVerifier;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        try {
            JWTClaimsSet claims = jwtVerifier.verify(token);

            String tokenType = getStringClaim(claims, "token_type");
            if (!"access".equals(tokenType)) {
                // Refresh and pre_auth tokens must not grant access to API endpoints
                filterChain.doFilter(request, response);
                return;
            }

            AuthContext ctx = buildAuthContext(claims);

            List<SimpleGrantedAuthority> authorities = ctx.permissions().stream()
                    .map(p -> new SimpleGrantedAuthority("PERM_" + p))
                    .collect(Collectors.toList());

            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(ctx, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (AppException e) {
            // Let Spring Security handle the 401 response via the entry point
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private static AuthContext buildAuthContext(JWTClaimsSet claims) {
        String subject         = claims.getSubject();
        String tenantId        = getStringClaim(claims, "tenant_id");
        String workspaceId     = getStringClaim(claims, "workspace_id");
        String userId          = getStringClaim(claims, "user_id");
        String serviceClientId = getStringClaim(claims, "client_id");
        String tokenType       = getStringClaim(claims, "token_type");
        List<String> audiences  = claims.getAudience();
        List<String> permissions = getListClaim(claims, "permissions");

        return new AuthContext(subject, tenantId, workspaceId, userId,
                serviceClientId, tokenType, audiences, permissions);
    }

    @SuppressWarnings("unchecked")
    private static List<String> getListClaim(JWTClaimsSet claims, String name) {
        Object val = claims.getClaim(name);
        if (val instanceof List<?> list) {
            return list.stream().map(Object::toString).collect(Collectors.toList());
        }
        return Collections.emptyList();
    }

    private static String getStringClaim(JWTClaimsSet claims, String name) {
        Object val = claims.getClaim(name);
        return val != null ? val.toString() : null;
    }
}
