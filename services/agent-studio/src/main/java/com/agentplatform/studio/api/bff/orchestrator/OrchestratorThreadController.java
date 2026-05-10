package com.agentplatform.studio.api.bff.orchestrator;

import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.studio.service.OrchestratorProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * BFF: proxies Thread CRUD to the agent-orchestrator service.
 * Base: /api/v1/orchestrator/threads
 */
@RestController
@RequestMapping("/api/v1/orchestrator/threads")
@RequiredArgsConstructor
public class OrchestratorThreadController {

    private final OrchestratorProxyService orchestrator;

    @PostMapping
    public ResponseEntity<ApiResponse<JsonNode>> create(@RequestBody JsonNode body) {
        JsonNode result = orchestrator.post("/threads", body);
        return ResponseEntity.status(201).body(ApiResponse.ok(result));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<JsonNode>> list(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        JsonNode result = orchestrator.get("/threads?limit=" + limit + "&offset=" + offset);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<JsonNode>> getById(@PathVariable String id) {
        JsonNode result = orchestrator.get("/threads/" + id);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{id}/runs")
    public ResponseEntity<ApiResponse<JsonNode>> listRuns(
            @PathVariable String id,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        JsonNode result = orchestrator.get("/threads/" + id + "/runs?limit=" + limit + "&offset=" + offset);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }
}
