package com.agentplatform.studio.service;

import com.agentplatform.common.exception.AppException;
import com.agentplatform.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

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

    private final ObjectMapper objectMapper;

    // ── Public (no auth) ─────────────────────────────────────────────────────

    public JsonNode publicPost(String path, Object body) {
        return proxyPost(iamPublicClient, path, body);
    }

    public JsonNode publicGet(String path) {
        return proxyGet(iamPublicClient, path);
    }

    public JsonNode publicFormPost(String path, MultiValueMap<String, String> form) {
        return proxyFormPost(iamPublicClient, path, form);
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

    public JsonNode authPatch(String path, Object body) {
        return proxyPatch(iamClient, path, body);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private JsonNode proxyPost(RestClient client, String path, Object body) {
        try {
            var spec = client.post().uri(path);
            if (body != null) {
                return spec.contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(JsonNode.class);
            }
            return spec.retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        } catch (RestClientException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, "IAM service is unavailable");
        }
    }

    private JsonNode proxyFormPost(RestClient client, String path, MultiValueMap<String, String> form) {
        try {
            return client.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        } catch (RestClientException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, "IAM service is unavailable");
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
        } catch (RestClientException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, "IAM service is unavailable");
        }
    }

    private JsonNode proxyPatch(RestClient client, String path, Object body) {
        try {
            var spec = client.patch()
                    .uri(path);
            if (body != null) {
                return spec.contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(JsonNode.class);
            }
            return spec.retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        } catch (RestClientException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, "IAM service is unavailable");
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
        } catch (RestClientException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, "IAM service is unavailable");
        }
    }

    /**
     * Maps an IAM 4xx response to an AppException, preserving IAM's error code and
     * message from the ApiResponse envelope rather than using a hardcoded string.
     */
    private AppException mapClientError(HttpClientErrorException e) {
        // Parse IAM's ApiResponse envelope: { "errorCode": "...", "message": "..." }
        String iamCode = null;
        String iamMessage = null;
        try {
            JsonNode body = objectMapper.readTree(e.getResponseBodyAsString());
            JsonNode codeNode = body.get("errorCode");
            JsonNode msgNode  = body.get("message");
            if (codeNode != null && !codeNode.isNull()) iamCode    = codeNode.asText();
            if (msgNode  != null && !msgNode.isNull())  iamMessage = msgNode.asText();
        } catch (Exception ignored) {}

        // If IAM sent a known error code, propagate it directly so the FE sees the right code.
        if (iamCode != null) {
            try {
                ErrorCode code = ErrorCode.valueOf(iamCode);
                return new AppException(code, iamMessage != null ? iamMessage : e.getMessage());
            } catch (IllegalArgumentException ignored) {}
        }

        // Fall back to HTTP-status mapping, still using IAM's message when available.
        String msg = iamMessage != null ? iamMessage : e.getMessage();
        HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
        return switch (status) {
            case UNAUTHORIZED -> new AppException(ErrorCode.UNAUTHORIZED, msg);
            case FORBIDDEN    -> new AppException(ErrorCode.FORBIDDEN,    msg);
            case NOT_FOUND    -> new AppException(ErrorCode.NOT_FOUND,    msg);
            case CONFLICT     -> new AppException(ErrorCode.CONFLICT,     msg);
            case BAD_REQUEST  -> new AppException(ErrorCode.VALIDATION_ERROR, msg);
            default           -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "IAM error: " + msg);
        };
    }
}
