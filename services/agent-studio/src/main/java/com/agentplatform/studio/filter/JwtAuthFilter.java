package com.agentplatform.studio.filter;

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
            AuthContext ctx = buildAuthContext(claims);

            List<SimpleGrantedAuthority> authorities = ctx.permissions().stream()
                    .map(p -> new SimpleGrantedAuthority("PERM_" + p))
                    .collect(Collectors.toList());

            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(ctx, token, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (AppException e) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private static AuthContext buildAuthContext(JWTClaimsSet claims) {
        return new AuthContext(
                claims.getSubject(),
                getStringClaim(claims, "tenant_id"),
                getStringClaim(claims, "workspace_id"),
                getStringClaim(claims, "user_id"),
                getStringClaim(claims, "client_id"),
                getStringClaim(claims, "token_type"),
                claims.getAudience(),
                getListClaim(claims, "permissions")
        );
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
