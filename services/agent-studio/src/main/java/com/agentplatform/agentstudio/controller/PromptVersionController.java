package com.agentplatform.agentstudio.controller;

import com.agentplatform.dto.ApiResponse;
import com.agentplatform.agentstudio.dto.prompt.CreatePromptVersionRequest;
import com.agentplatform.agentstudio.dto.prompt.PromptVersionResponse;
import com.agentplatform.agentstudio.service.PromptVersionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/agents/{agentId}/prompts")
@RequiredArgsConstructor
@Tag(name = "Prompt Versions", description = "Prompt version management per agent")
public class PromptVersionController {

    private final PromptVersionService promptVersionService;

    @GetMapping
    @Operation(summary = "List all prompt versions for an agent")
    public ResponseEntity<ApiResponse<List<PromptVersionResponse>>> listPromptVersions(
            @PathVariable UUID agentId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(promptVersionService.listPromptVersions(agentId)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a prompt version by ID")
    public ResponseEntity<ApiResponse<PromptVersionResponse>> getPromptVersion(
            @PathVariable UUID agentId,
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(promptVersionService.getPromptVersion(agentId, id)));
    }

    @PostMapping
    @Operation(summary = "Create a new prompt version for an agent")
    public ResponseEntity<ApiResponse<PromptVersionResponse>> createPromptVersion(
            @PathVariable UUID agentId,
            @Valid @RequestBody CreatePromptVersionRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(promptVersionService.createPromptVersion(agentId, req)));
    }

    @PostMapping("/{id}/activate")
    @Operation(summary = "Activate a prompt version (deactivates all others)")
    public ResponseEntity<ApiResponse<PromptVersionResponse>> activatePromptVersion(
            @PathVariable UUID agentId,
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(promptVersionService.activatePromptVersion(agentId, id)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a prompt version")
    public ResponseEntity<ApiResponse<Void>> deletePromptVersion(
            @PathVariable UUID agentId,
            @PathVariable UUID id
    ) {
        promptVersionService.deletePromptVersion(agentId, id);
        return ResponseEntity.ok(ApiResponse.ok("Prompt version deleted"));
    }
}
