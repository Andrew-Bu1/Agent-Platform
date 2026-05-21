package com.agentplatform.studio.service;

import com.agentplatform.common.exception.AppException;
import com.agentplatform.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Thin proxy for the AIHub service (bearer forwarded).
 */
@Service
@RequiredArgsConstructor
public class AihubProxyService {

    @Qualifier("aihubClient")
    private final RestClient aihubClient;

    public JsonNode get(String path) {
        try {
            return aihubClient.get()
                    .uri(path)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    public JsonNode post(String path, Object body) {
        try {
            return aihubClient.post()
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
            return aihubClient.put()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    public JsonNode patch(String path, Object body) {
        try {
            return aihubClient.patch()
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
            return aihubClient.delete()
                    .uri(path)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    /**
     * Streams an SSE chat response from AIHub to the given SseEmitter.
     * The body must include {@code "stream": true}.
     */
    @Async("sseProxyExecutor")
    public void chatStream(String path, Object body, String authorization, SseEmitter emitter) {
        try {
            aihubClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.TEXT_EVENT_STREAM)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .body(body)
                    .exchange((req, resp) -> {
                        if (!resp.getStatusCode().is2xxSuccessful()) {
                            String errorBody = StreamUtils.copyToString(resp.getBody(), StandardCharsets.UTF_8);
                            if (errorBody.isBlank()) {
                                errorBody = "{\"detail\":\"AIHub returned HTTP " + resp.getStatusCode().value() + "\"}";
                            }
                            emitter.send(SseEmitter.event()
                                    .name("error")
                                    .data(errorBody, MediaType.APPLICATION_JSON));
                            return null;
                        }
                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(resp.getBody(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                if (line.startsWith("data:")) {
                                    String data = line.substring("data:".length()).trim();
                                    emitter.send(SseEmitter.event().data(data, MediaType.TEXT_PLAIN));
                                    if ("[DONE]".equals(data)) {
                                        break;
                                    }
                                }
                            }
                        } catch (IOException e) {
                            emitter.completeWithError(e);
                        }
                        return null;
                    });
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
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
            default           -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "AIHub service error: " + e.getMessage());
        };
    }
}
