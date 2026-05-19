package com.agentplatform.studio.api.bff.aihub;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.studio.service.AihubProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.UUID;

/**
 * BFF proxy for AIHub model and provider management.
 * All routes require authentication (bearer forwarded to AIHub).
 */
@RestController
@RequestMapping("/api/v1/aihub")
@RequiredArgsConstructor
public class AihubProxyController {

    private final AihubProxyService aihubProxy;

    // ── Models ────────────────────────────────────────────────────────────────

    @GetMapping("/models")
    public ApiResponse<JsonNode> listModels(
            @AuthenticationPrincipal AuthContext auth,
            @RequestParam(name = "operation_type", required = false) String operationType,
            @RequestParam(name = "provider_key",   required = false) String providerKey) {
        String path = UriComponentsBuilder.fromPath("/v1/models")
                .queryParamIfPresent("operation_type",  java.util.Optional.ofNullable(operationType))
                .queryParamIfPresent("provider_key",    java.util.Optional.ofNullable(providerKey))
                .build().toUriString();
        return ApiResponse.ok(aihubProxy.get(path));
    }

    @GetMapping("/models/{id}")
    public ApiResponse<JsonNode> getModel(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(aihubProxy.get("/v1/models/" + id));
    }

    @PostMapping("/models")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<JsonNode> createModel(@AuthenticationPrincipal AuthContext auth, @RequestBody JsonNode body) {
        return ApiResponse.ok(aihubProxy.post("/v1/models", body));
    }

    @PatchMapping("/models/{id}")
    public ApiResponse<JsonNode> updateModel(@AuthenticationPrincipal AuthContext auth,
                                @PathVariable UUID id,
                                @RequestBody JsonNode body) {
        return ApiResponse.ok(aihubProxy.patch("/v1/models/" + id, body));
    }

    @DeleteMapping("/models/{id}")
    public ApiResponse<JsonNode> deleteModel(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(aihubProxy.delete("/v1/models/" + id));
    }

    // ── Providers ─────────────────────────────────────────────────────────────

    @GetMapping("/providers")
    public ApiResponse<JsonNode> listProviders(@AuthenticationPrincipal AuthContext auth) {
        return ApiResponse.ok(aihubProxy.get("/v1/providers"));
    }

    @GetMapping("/providers/{id}")
    public ApiResponse<JsonNode> getProvider(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(aihubProxy.get("/v1/providers/" + id));
    }

    @PostMapping("/providers")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<JsonNode> createProvider(@AuthenticationPrincipal AuthContext auth, @RequestBody JsonNode body) {
        return ApiResponse.ok(aihubProxy.post("/v1/providers", body));
    }

    @PatchMapping("/providers/{id}")
    public ApiResponse<JsonNode> updateProvider(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID id,
                                   @RequestBody JsonNode body) {
        return ApiResponse.ok(aihubProxy.patch("/v1/providers/" + id, body));
    }

    @DeleteMapping("/providers/{id}")
    public ApiResponse<JsonNode> deleteProvider(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(aihubProxy.delete("/v1/providers/" + id));
    }

    // ── Chat ──────────────────────────────────────────────────────────────────

    @PostMapping("/chat")
    public ApiResponse<JsonNode> chat(@AuthenticationPrincipal AuthContext auth, @RequestBody JsonNode body) {
        return ApiResponse.ok(aihubProxy.post("/v1/chat", body));
    }

    @PostMapping(value = "/chat/stream", produces = "text/event-stream")
    public SseEmitter chatStream(@AuthenticationPrincipal AuthContext auth, @RequestBody JsonNode body) {
        SseEmitter emitter = new SseEmitter(120_000L);
        aihubProxy.chatStream("/v1/chat", body, emitter);
        return emitter;
    }

    // ── Usage logs ────────────────────────────────────────────────────────────

    @GetMapping("/model-usage-logs")
    public ApiResponse<JsonNode> listUsageLogs(
            @AuthenticationPrincipal AuthContext auth,
            @RequestParam(name = "model_id",  required = false) String modelId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset) {
        String path = UriComponentsBuilder.fromPath("/v1/model-usage-logs")
                .queryParamIfPresent("model_id", java.util.Optional.ofNullable(modelId))
                .queryParamIfPresent("status",   java.util.Optional.ofNullable(status))
                .queryParamIfPresent("limit",    java.util.Optional.ofNullable(limit))
                .queryParamIfPresent("offset",   java.util.Optional.ofNullable(offset))
                .build().toUriString();
        return ApiResponse.ok(aihubProxy.get(path));
    }

    // ── Platform analytics ────────────────────────────────────────────────────

    @GetMapping("/platform/analytics/usage")
    public ApiResponse<JsonNode> platformAnalyticsUsage(
            @AuthenticationPrincipal AuthContext auth,
            @RequestParam(required = false) String tenant_id,
            @RequestParam(required = false) Integer days) {
        StringBuilder path = new StringBuilder("/v1/platform/analytics/usage");
        String sep = "?";
        if (tenant_id != null && !tenant_id.isBlank()) {
            path.append(sep).append("tenant_id=").append(tenant_id);
            sep = "&";
        }
        if (days != null) {
            path.append(sep).append("days=").append(days);
        }
        return ApiResponse.ok(aihubProxy.get(path.toString()));
    }
}
