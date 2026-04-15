package com.agentplatform.agentstudio.controller;

import com.agentplatform.dto.ApiResponse;
import com.agentplatform.agentstudio.dto.tool.CreateToolRequest;
import com.agentplatform.agentstudio.dto.tool.ToolResponse;
import com.agentplatform.agentstudio.dto.tool.UpdateToolRequest;
import com.agentplatform.agentstudio.service.ToolService;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tools")
@RequiredArgsConstructor
@Tag(name = "Tools", description = "Tool management")
public class ToolController {

    private final ToolService toolService;

    @GetMapping
    @Operation(summary = "List tools for the current tenant")
    public ResponseEntity<ApiResponse<Page<ToolResponse>>> listTools(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.ok(toolService.listTools(search, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a tool by ID")
    public ResponseEntity<ApiResponse<ToolResponse>> getTool(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(toolService.getTool(id)));
    }

    @PostMapping
    @Operation(summary = "Create a new tool")
    public ResponseEntity<ApiResponse<ToolResponse>> createTool(
            @Valid @RequestBody CreateToolRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(toolService.createTool(req)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a tool")
    public ResponseEntity<ApiResponse<ToolResponse>> updateTool(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateToolRequest req
    ) {
        return ResponseEntity.ok(ApiResponse.ok(toolService.updateTool(id, req)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a tool")
    public ResponseEntity<ApiResponse<Void>> deleteTool(@PathVariable UUID id) {
        toolService.deleteTool(id);
        return ResponseEntity.ok(ApiResponse.ok("Tool deleted"));
    }
}
