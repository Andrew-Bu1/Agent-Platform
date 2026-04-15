package com.agentplatform.security;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;

import java.time.Instant;
import java.util.UUID;

/**
 * Shared helper for issuing HMAC HS256 JWT access tokens.
 * This is a plain class — declare it as a {@code @Bean} in the issuing service's config:
 *
 * <pre>{@code
 *   @Bean
 *   public JwtTokenProvider jwtTokenProvider(JwtEncoder jwtEncoder,
 *       @Value("${app.jwt.access-token-expiry-seconds:900}") long expirySeconds) {
 *       return new JwtTokenProvider(jwtEncoder, expirySeconds);
 *   }
 * }</pre>
 *
 * <p>Only the access-service (token issuer) needs this. Resource-server services
 * only need {@link JwtUtils#buildDecoder(String)} and {@link SecurityUtils}.
 */
public class JwtTokenProvider {

    private final JwtEncoder jwtEncoder;
    private final long accessTokenExpirySeconds;

    public JwtTokenProvider(JwtEncoder jwtEncoder, long accessTokenExpirySeconds) {
        this.jwtEncoder = jwtEncoder;
        this.accessTokenExpirySeconds = accessTokenExpirySeconds;
    }

    /**
     * Issues a signed access token embedding {@code userId} as {@code sub}
     * and {@code tenantId} as a custom claim.
     */
    public String generateAccessToken(UUID userId, UUID tenantId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(userId.toString())
                .claim("tenantId", tenantId.toString())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(accessTokenExpirySeconds))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public long getAccessTokenExpirySeconds() {
        return accessTokenExpirySeconds;
    }
}
