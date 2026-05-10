package com.agentplatform.studio.api.bff.aihub;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.service.AihubProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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
    public JsonNode listModels(@AuthenticationPrincipal AuthContext auth) {
        return aihubProxy.get("/v1/models");
    }

    @GetMapping("/models/{id}")
    public JsonNode getModel(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return aihubProxy.get("/v1/models/" + id);
    }

    @PostMapping("/models")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createModel(@AuthenticationPrincipal AuthContext auth, @RequestBody JsonNode body) {
        return aihubProxy.post("/v1/models", body);
    }

    @PutMapping("/models/{id}")
    public JsonNode updateModel(@AuthenticationPrincipal AuthContext auth,
                                @PathVariable UUID id,
                                @RequestBody JsonNode body) {
        return aihubProxy.put("/v1/models/" + id, body);
    }

    @DeleteMapping("/models/{id}")
    public JsonNode deleteModel(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return aihubProxy.delete("/v1/models/" + id);
    }

    // ── Providers ─────────────────────────────────────────────────────────────

    @GetMapping("/providers")
    public JsonNode listProviders(@AuthenticationPrincipal AuthContext auth) {
        return aihubProxy.get("/v1/providers");
    }

    @GetMapping("/providers/{id}")
    public JsonNode getProvider(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return aihubProxy.get("/v1/providers/" + id);
    }

    @PostMapping("/providers")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createProvider(@AuthenticationPrincipal AuthContext auth, @RequestBody JsonNode body) {
        return aihubProxy.post("/v1/providers", body);
    }

    @PutMapping("/providers/{id}")
    public JsonNode updateProvider(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID id,
                                   @RequestBody JsonNode body) {
        return aihubProxy.put("/v1/providers/" + id, body);
    }

    @DeleteMapping("/providers/{id}")
    public JsonNode deleteProvider(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return aihubProxy.delete("/v1/providers/" + id);
    }

    // ── Usage logs ────────────────────────────────────────────────────────────

    @GetMapping("/model-usage-logs")
    public JsonNode listUsageLogs(@AuthenticationPrincipal AuthContext auth) {
        return aihubProxy.get("/v1/model-usage-logs");
    }
}
