package com.agentplatform.studio.config;

import com.agentplatform.common.security.JwksClient;
import com.agentplatform.common.security.JwtVerifier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class JwtConfig {

    @Bean
    public JwtVerifier jwtVerifier(@Value("${app.iam.url}") String iamUrl) {
        String jwksUrl = iamUrl.replaceAll("/+$", "") + "/.well-known/jwks.json";
        log.info("Wiring JwksClient against IAM JWKS endpoint: {}", jwksUrl);
        return new JwtVerifier(new JwksClient(jwksUrl));
    }
}
