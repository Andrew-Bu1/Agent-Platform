package com.agentplatform.studio.config;

import java.net.http.HttpClient;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestClient;

@Configuration
public class DownstreamConfig {

    /**
     * HTTP/1.1-only factory shared by all downstream clients.
     *
     * Spring Boot 3.4 defaults RestClient to JdkClientHttpRequestFactory whose
     * underlying HttpClient negotiates HTTP/2 by default. On plain HTTP
     * connections it sends an "Upgrade: h2c" header; uvicorn and plain Go HTTP
     * servers do not support h2c and log spurious warnings ("Unsupported upgrade
     * request / Invalid HTTP request received"). Pinning to HTTP_1_1 prevents
     * the upgrade attempt. SSE streaming still works — it relies on chunked
     * transfer encoding which is a standard HTTP/1.1 feature.
     */
    private static JdkClientHttpRequestFactory http11Factory() {
        return new JdkClientHttpRequestFactory(
                HttpClient.newBuilder()
                        .version(HttpClient.Version.HTTP_1_1)
                        .build());
    }

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
                .requestFactory(http11Factory())
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }

    @Bean
    public RestClient datahubClient(@Value("${app.datahub.url}") String baseUrl) {
        return RestClient.builder()
                .requestFactory(http11Factory())
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }

    /** Client for IAM endpoints that require an authenticated caller (bearer forwarded). */
    @Bean("iamClient")
    public RestClient iamClient(@Value("${app.iam.url}") String baseUrl) {
        return RestClient.builder()
                .requestFactory(http11Factory())
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }

    /** Client for IAM endpoints that are publicly accessible (login, refresh, signup). */
    @Bean("iamPublicClient")
    public RestClient iamPublicClient(@Value("${app.iam.url}") String baseUrl) {
        return RestClient.builder()
                .requestFactory(http11Factory())
                .baseUrl(baseUrl)
                .build();
    }

    /** Client for the agent orchestrator (bearer forwarded). */
    @Bean("orchestratorClient")
    public RestClient orchestratorClient(@Value("${app.orchestrator.url}") String baseUrl) {
        return RestClient.builder()
                .requestFactory(http11Factory())
                .baseUrl(baseUrl)
                .requestInterceptor(bearerForwardInterceptor())
                .build();
    }
}
