package com.agentplatform.agentstudio.controller;

import com.agentplatform.dto.ApiResponse;
import com.agentplatform.agentstudio.dto.agent.AgentResponse;
import com.agentplatform.agentstudio.dto.agent.CreateAgentRequest;
import com.agentplatform.agentstudio.dto.agent.UpdateAgentRequest;
import com.agentplatform.agentstudio.dto.tool.ToolResponse;
import com.agentplatform.agentstudio.service.AgentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
@Tag(name = "Agents", description = "Agent management")
public class AgentController {

    private final AgentService agentService;

    @GetMapping
    @Operation(summary = "List agents for the current tenant")
    public ResponseEntity<ApiResponse<Page<AgentResponse>>> listAgents(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.ok(agentService.listAgents(search, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an agent by ID")
    public ResponseEntity<ApiResponse<AgentResponse>> getAgent(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(agentService.getAgent(id)));
    }

    @PostMapping
    @Operation(summary = "Create a new agent")
    public ResponseEntity<ApiResponse<AgentResponse>> createAgent(
            @Valid @RequestBody CreateAgentRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(agentService.createAgent(req)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an agent")
    public ResponseEntity<ApiResponse<AgentResponse>> updateAgent(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAgentRequest req
    ) {
        return ResponseEntity.ok(ApiResponse.ok(agentService.updateAgent(id, req)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an agent")
    public ResponseEntity<ApiResponse<Void>> deleteAgent(@PathVariable UUID id) {
        agentService.deleteAgent(id);
        return ResponseEntity.ok(ApiResponse.ok("Agent deleted"));
    }

    @GetMapping("/{id}/tools")
    @Operation(summary = "List tools assigned to an agent")
    public ResponseEntity<ApiResponse<List<ToolResponse>>> getAgentTools(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(agentService.getAgentTools(id)));
    }

    @PostMapping("/{id}/tools/{toolId}")
    @Operation(summary = "Add a tool to an agent")
    public ResponseEntity<ApiResponse<Void>> addTool(
            @PathVariable UUID id,
            @PathVariable UUID toolId
    ) {
        agentService.addTool(id, toolId);
        return ResponseEntity.ok(ApiResponse.ok("Tool added to agent"));
    }

    @DeleteMapping("/{id}/tools/{toolId}")
    @Operation(summary = "Remove a tool from an agent")
    public ResponseEntity<ApiResponse<Void>> removeTool(
            @PathVariable UUID id,
            @PathVariable UUID toolId
    ) {
        agentService.removeTool(id, toolId);
        return ResponseEntity.ok(ApiResponse.ok("Tool removed from agent"));
    }
}
