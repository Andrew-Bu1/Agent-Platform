package com.agentplatform.studio.api.bff.orchestrator;

import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.studio.service.OrchestratorProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * BFF: proxies Run CRUD + SSE streaming to the agent-orchestrator service.
 * Base: /api/v1/orchestrator/runs
 */
@RestController
@RequestMapping("/api/v1/orchestrator/runs")
@RequiredArgsConstructor
public class OrchestratorRunController {

    private final OrchestratorProxyService orchestrator;

    @PostMapping
    public ResponseEntity<ApiResponse<JsonNode>> create(@RequestBody JsonNode body) {
        // The orchestrator streams SSE on POST /runs, but we return the initial run object
        // as JSON here. The client should use GET /runs/{id}/events for the stream.
        JsonNode result = orchestrator.post("/runs", body);
        return ResponseEntity.status(201).body(ApiResponse.ok(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<JsonNode>> getById(@PathVariable String id) {
        JsonNode result = orchestrator.get("/runs/" + id);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<JsonNode>> cancel(@PathVariable String id) {
        JsonNode result = orchestrator.post("/runs/" + id + "/cancel", null);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<ApiResponse<JsonNode>> resume(
            @PathVariable String id,
            @RequestBody JsonNode body) {
        JsonNode result = orchestrator.post("/runs/" + id + "/resume", body);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * Streams run events from the orchestrator via SSE.
     * The SseEmitter timeout is set to -1 (no timeout) to allow long-running flows.
     */
    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamEvents(@PathVariable String id) {
        SseEmitter emitter = new SseEmitter(-1L);
        orchestrator.streamEvents("/runs/" + id + "/events", emitter);
        return emitter;
    }

    @GetMapping("/pending-review")
    public ResponseEntity<ApiResponse<JsonNode>> listPendingReview() {
        JsonNode result = orchestrator.get("/runs/pending-review");
        return ResponseEntity.ok(ApiResponse.ok(result));
    }
}
