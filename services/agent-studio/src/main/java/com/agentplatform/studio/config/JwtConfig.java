package com.agentplatform.studio.config;

import com.agentplatform.common.security.JwtVerifier;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Slf4j
@Configuration
public class JwtConfig {

    /**
     * Fetches the IAM public JWK set at startup and wires a {@link JwtVerifier}.
     * IAM exposes its active public key at {@code GET /.well-known/jwks.json}.
     * No PEM files or shared secrets needed — only the public key is used here.
     */
    @Bean
    public JwtVerifier jwtVerifier(@Value("${app.iam.url}") String iamUrl) throws Exception {
        String jwksUrl  = iamUrl.replaceAll("/+$", "") + "/.well-known/jwks.json";
        String jwksJson = RestClient.create()
                .get()
                .uri(jwksUrl)
                .retrieve()
                .body(String.class);

        JWKSet  jwkSet = JWKSet.parse(jwksJson);
        RSAKey  rsaKey = (RSAKey) jwkSet.getKeys().get(0);

        log.info("Loaded IAM public signing key: kid={}", rsaKey.getKeyID());
        return new JwtVerifier(rsaKey.toPublicJWK());
    }
}
