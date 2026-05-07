package com.agentplatform.iam.security;

import com.agentplatform.common.security.JwtClaims;
import com.agentplatform.common.security.JwtProperties;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

/**
 * RS256 JWT issuer — only IAM service should have this bean.
 *
 * <p>Wire up in IAM's {@code @Configuration}:
 * <pre>
 * &#64;Bean
 * public JwtIssuer jwtIssuer(JwtProperties props, ResourceLoader loader) throws Exception {
 *     RSAPublicKey  pub  = JwtKeyLoader.loadPublicKey(loader.getResource(props.getPublicKeyPath()));
 *     RSAPrivateKey priv = JwtKeyLoader.loadPrivateKey(loader.getResource(props.getPrivateKeyPath()));
 *     RSAKey rsaKey = new RSAKey.Builder(pub).privateKey(priv).keyID(props.getKeyId()).build();
 *     return new JwtIssuer(rsaKey, props);
 * }
 * </pre>
 */
public class JwtIssuer {

    private final RSAKey rsaKey;
    private final JwtProperties props;

    public JwtIssuer(RSAKey rsaKey, JwtProperties props) {
        if (!rsaKey.isPrivate()) {
            throw new IllegalStateException("JwtIssuer requires an RSA key with a private key component");
        }
        this.rsaKey = rsaKey;
        this.props  = props;
    }

    /**
     * Issue an access token with the configured TTL.
     *
     * @param claims subject + audiences + custom claims (tenant_id, permissions, etc.)
     * @return compact serialized JWT string
     */
    public String issueAccessToken(JwtClaims claims) {
        return buildToken(claims, props.getAccessTokenTtlSeconds(), "access");
    }

    /**
     * Issue a refresh token with the configured TTL.
     * Refresh tokens carry minimal claims — just subject and token_type.
     *
     * @param subject user UUID or service_client UUID
     * @return compact serialized JWT string
     */
    public String issueRefreshToken(String subject) {
        JwtClaims minimalClaims = new JwtClaims(subject, props.getIssuer() != null
                ? java.util.List.of(props.getIssuer()) : java.util.List.of(), Map.of());
        return buildToken(minimalClaims, props.getRefreshTokenTtlSeconds(), "refresh");
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private String buildToken(JwtClaims claims, long ttlSeconds, String tokenType) {
        Instant now = Instant.now();

        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .jwtID(UUID.randomUUID().toString())
                .issuer(props.getIssuer())
                .subject(claims.subject())
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(ttlSeconds)))
                .claim("token_type", tokenType);

        if (!claims.audiences().isEmpty()) {
            builder.audience(claims.audiences());
        }

        for (Map.Entry<String, Object> entry : claims.customClaims().entrySet()) {
            builder.claim(entry.getKey(), entry.getValue());
        }

        try {
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(rsaKey.getKeyID()).build(),
                    builder.build()
            );
            jwt.sign(new RSASSASigner(rsaKey.toRSAPrivateKey()));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to sign JWT", e);
        }
    }
}
