package com.agentplatform.common.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT configuration properties bound from application.yml under {@code app.jwt}.
 *
 * <pre>
 * app:
 *   jwt:
 *     # IAM service: both keys required for signing
 *     private-key-path: classpath:keys/private.pem
 *     # All services: public key required for token verification
 *     public-key-path: classpath:keys/public.pem
 *     key-id: iam-rs256-2026
 *     issuer: iam-service
 *     access-token-ttl-seconds: 3600
 *     refresh-token-ttl-seconds: 604800
 * </pre>
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /** Path to PKCS#8 PEM private key (required only on the signing service). */
    private String privateKeyPath;

    /** Path to X.509 PEM public key (required on all services that verify tokens). */
    private String publicKeyPath;

    /** Key ID embedded in the JWT header and JWKS endpoint. */
    private String keyId = "iam-rs256-key";

    /** JWT issuer claim (iss). */
    private String issuer = "iam-service";

    /** Access token lifetime in seconds. Default: 1 hour. */
    private long accessTokenTtlSeconds = 3600L;

    /** Refresh token lifetime in seconds. Default: 7 days. */
    private long refreshTokenTtlSeconds = 604_800L;
}
