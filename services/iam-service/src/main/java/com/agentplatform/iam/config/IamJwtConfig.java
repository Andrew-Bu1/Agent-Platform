package com.agentplatform.iam.config;

import com.agentplatform.common.security.JwtProperties;
import com.agentplatform.common.security.JwtVerifier;
import com.agentplatform.iam.security.JwtIssuer;
import com.agentplatform.iam.service.SigningKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;

/**
 * Wires {@link JwtVerifier} and {@link JwtIssuer} beans from the active signing key
 * loaded by {@link SigningKeyService}.
 *
 * <p>{@code @DependsOn("signingKeyService")} ensures {@link SigningKeyService#init()} runs
 * (via {@code @PostConstruct}) before these beans are created.
 */
@Configuration
@RequiredArgsConstructor
@DependsOn("signingKeyService")
public class IamJwtConfig {

    private final SigningKeyService signingKeyService;
    private final JwtProperties     jwtProperties;

    @Bean
    public JwtVerifier jwtVerifier() {
        // toPublicJWK() strips the private key — verifier holds public only
        return new JwtVerifier(signingKeyService.getActiveKey().toPublicJWK());
    }

    @Bean
    public JwtIssuer jwtIssuer() {
        // Full RSAKey with private component — signing only in IAM
        return new JwtIssuer(signingKeyService.getActiveKey(), jwtProperties);
    }
}
