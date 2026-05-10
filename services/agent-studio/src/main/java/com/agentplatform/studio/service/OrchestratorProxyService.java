package com.agentplatform.studio.service;

import com.agentplatform.common.exception.AppException;
import com.agentplatform.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

/**
 * Thin proxy for the Agent Orchestrator service (bearer forwarded).
 * SSE streaming is delegated to an async thread pool via @Async("sseProxyExecutor").
 */
@Service
@RequiredArgsConstructor
public class OrchestratorProxyService {

    @Qualifier("orchestratorClient")
    private final RestClient orchestratorClient;

    public JsonNode get(String path) {
        try {
            return orchestratorClient.get()
                    .uri(path)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    public JsonNode post(String path, Object body) {
        try {
            return orchestratorClient.post()
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
            return orchestratorClient.delete()
                    .uri(path)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError(e);
        }
    }

    /**
     * Streams SSE events from the orchestrator to the given SseEmitter.
     * Must be called from an async context (the caller should already have an SseEmitter).
     */
    @Async("sseProxyExecutor")
    public void streamEvents(String path, SseEmitter emitter) {
        try {
            orchestratorClient.get()
                    .uri(path)
                    .accept(MediaType.TEXT_EVENT_STREAM)
                    .exchange((req, resp) -> {
                        try (var body = resp.getBody()) {
                            byte[] buf = new byte[8192];
                            int read;
                            StringBuilder lineBuffer = new StringBuilder();
                            while ((read = body.read(buf)) != -1) {
                                String chunk = new String(buf, 0, read);
                                lineBuffer.append(chunk);
                                // Flush on double newline (SSE event boundary)
                                String content = lineBuffer.toString();
                                int idx;
                                while ((idx = content.indexOf("\n\n")) != -1) {
                                    String event = content.substring(0, idx + 2);
                                    emitter.send(SseEmitter.event().data(event, MediaType.TEXT_PLAIN));
                                    content = content.substring(idx + 2);
                                }
                                lineBuffer = new StringBuilder(content);
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

    private AppException mapClientError(HttpClientErrorException e) {
        HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
        return switch (status) {
            case UNAUTHORIZED -> new AppException(ErrorCode.UNAUTHORIZED, e.getMessage());
            case FORBIDDEN -> new AppException(ErrorCode.FORBIDDEN, e.getMessage());
            case NOT_FOUND -> new AppException(ErrorCode.NOT_FOUND, e.getMessage());
            case CONFLICT -> new AppException(ErrorCode.CONFLICT, e.getMessage());
            case BAD_REQUEST -> new AppException(ErrorCode.VALIDATION_ERROR, e.getMessage());
            default -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR, e.getMessage());
        };
    }
}
