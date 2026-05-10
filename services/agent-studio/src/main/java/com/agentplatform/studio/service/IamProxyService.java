package com.agentplatform.studio.service;

import com.agentplatform.common.exception.AppException;
import com.agentplatform.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Thin proxy for the IAM service.
 * <p>
 * Uses {@code iamPublicClient} for unauthenticated requests (login, refresh, signup)
 * and {@code iamClient} for requests that require a forwarded bearer token.
 */
@Service
@RequiredArgsConstructor
public class IamProxyService {

    @Qualifier("iamPublicClient")
    private final RestClient iamPublicClient;

    @Qualifier("iamClient")
    private final RestClient iamClient;

    // ── Public (no auth) ─────────────────────────────────────────────────────

    public JsonNode publicPost(String path, Object body) {
        return proxyPost(iamPublicClient, path, body);
    }

    public JsonNode publicGet(String path) {
        return proxyGet(iamPublicClient, path);
    }

    // ── Authenticated (bearer forwarded) ─────────────────────────────────────

    public JsonNode authPost(String path, Object body) {
        return proxyPost(iamClient, path, body);
    }

    public JsonNode authGet(String path) {
        return proxyGet(iamClient, path);
    }

    public JsonNode authDelete(String path) {
        return proxyDelete(iamClient, path);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private JsonNode proxyPost(RestClient client, String path, Object body) {
        try {
            return client.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    private JsonNode proxyGet(RestClient client, String path) {
        try {
            return client.get()
                    .uri(path)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    private JsonNode proxyDelete(RestClient client, String path) {
        try {
            return client.delete()
                    .uri(path)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    private static AppException mapClientError(HttpClientErrorException e) {
        HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
        return switch (status) {
            case UNAUTHORIZED -> new AppException(ErrorCode.UNAUTHORIZED, "Authentication required");
            case FORBIDDEN    -> new AppException(ErrorCode.FORBIDDEN, "Access denied");
            case NOT_FOUND    -> new AppException(ErrorCode.NOT_FOUND, e.getMessage());
            case CONFLICT     -> new AppException(ErrorCode.CONFLICT, e.getMessage());
            case BAD_REQUEST  -> new AppException(ErrorCode.VALIDATION_ERROR, e.getMessage());
            default           -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "IAM service error: " + e.getMessage());
        };
    }
}
