package com.agentplatform.studio.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestClient;

@Configuration
public class DownstreamConfig {

    /**
     * Forwards the caller's JWT to an internal service.
     * The token was stored as credentials by JwtAuthFilter so we don't need
     * to re-read the Authorization header from the request.
     */
    private static ClientHttpRequestInterceptor bearerForwardInterceptor() {
        return (request, body, execution) -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getCredentials() instanceof String token) {
                request.getHeaders().setBearerAuth(token);
            }
            return execution.execute(request, body);
        };
    }

    @Bean
    public RestClient aihubClient(@Value("${app.aihub.url}") String baseUrl) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }

    @Bean
    public RestClient datahubClient(@Value("${app.datahub.url}") String baseUrl) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }

    /** Client for IAM endpoints that require an authenticated caller (bearer forwarded). */
    @Bean("iamClient")
    public RestClient iamClient(@Value("${app.iam.url}") String baseUrl) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }

    /** Client for IAM endpoints that are publicly accessible (login, refresh, signup). */
    @Bean("iamPublicClient")
    public RestClient iamPublicClient(@Value("${app.iam.url}") String baseUrl) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    /** Client for the agent orchestrator (bearer forwarded). */
    @Bean("orchestratorClient")
    public RestClient orchestratorClient(@Value("${app.orchestrator.url}") String baseUrl) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }
}
