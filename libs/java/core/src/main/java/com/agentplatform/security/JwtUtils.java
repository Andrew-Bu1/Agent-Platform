package com.agentplatform.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Shared factory for building HMAC HS256 JWT decoders and encoders.
 * Services declare {@link JwtDecoder}/{@link JwtEncoder} beans by calling these static methods
 * instead of duplicating the Nimbus boilerplate in each SecurityConfig.
 *
 * <p>Usage in a service's {@code @Configuration}:
 * <pre>{@code
 *   @Bean
 *   public JwtDecoder jwtDecoder(@Value("${app.jwt.secret}") String secret) {
 *       return JwtUtils.buildDecoder(secret);
 *   }
 * }</pre>
 */
public final class JwtUtils {

    private JwtUtils() {}

    /**
     * Derives a {@link SecretKey} (HmacSHA256) from a raw string secret.
     */
    public static SecretKey secretKey(String secret) {
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /**
     * Builds an HMAC HS256 {@link JwtDecoder} from a raw string secret.
     * Use this in resource-server services to validate incoming Bearer tokens.
     */
    public static JwtDecoder buildDecoder(String secret) {
        return NimbusJwtDecoder.withSecretKey(secretKey(secret)).build();
    }

    /**
     * Builds an HMAC HS256 {@link JwtEncoder} from a raw string secret.
     * Use this in the issuing service (access-service) to sign tokens.
     */
    public static JwtEncoder buildEncoder(String secret) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(secret)));
    }
}
