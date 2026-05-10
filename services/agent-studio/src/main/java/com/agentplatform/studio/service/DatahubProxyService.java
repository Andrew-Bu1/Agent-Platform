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
 * Thin proxy for the DataHub service (bearer forwarded).
 */
@Service
@RequiredArgsConstructor
public class DatahubProxyService {

    @Qualifier("datahubClient")
    private final RestClient datahubClient;

    public JsonNode get(String path) {
        try {
            return datahubClient.get()
                    .uri(path)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    public JsonNode post(String path, Object body) {
        try {
            return datahubClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    public JsonNode put(String path, Object body) {
        try {
            return datahubClient.put()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    public JsonNode delete(String path) {
        try {
            return datahubClient.delete()
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
            default           -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "DataHub service error: " + e.getMessage());
        };
    }
}
