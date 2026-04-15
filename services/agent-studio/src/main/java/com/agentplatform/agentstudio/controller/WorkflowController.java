package com.agentplatform.agentstudio.controller;

import com.agentplatform.dto.ApiResponse;
import com.agentplatform.agentstudio.dto.workflow.CreateWorkflowRequest;
import com.agentplatform.agentstudio.dto.workflow.CreateWorkflowVersionRequest;
import com.agentplatform.agentstudio.dto.workflow.UpdateWorkflowRequest;
import com.agentplatform.agentstudio.dto.workflow.UpdateWorkflowVersionRequest;
import com.agentplatform.agentstudio.dto.workflow.WorkflowResponse;
import com.agentplatform.agentstudio.dto.workflow.WorkflowVersionResponse;
import com.agentplatform.agentstudio.service.WorkflowService;
import com.agentplatform.agentstudio.service.WorkflowVersionService;
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
@RequestMapping("/api/v1/workflows")
@RequiredArgsConstructor
@Tag(name = "Workflows", description = "Workflow and version management")
public class WorkflowController {

    private final WorkflowService workflowService;
    private final WorkflowVersionService workflowVersionService;

    // ── Workflow CRUD ─────────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "List workflows for the current tenant")
    public ResponseEntity<ApiResponse<Page<WorkflowResponse>>> listWorkflows(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.ok(workflowService.listWorkflows(search, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a workflow by ID")
    public ResponseEntity<ApiResponse<WorkflowResponse>> getWorkflow(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(workflowService.getWorkflow(id)));
    }

    @PostMapping
    @Operation(summary = "Create a new workflow")
    public ResponseEntity<ApiResponse<WorkflowResponse>> createWorkflow(
            @Valid @RequestBody CreateWorkflowRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(workflowService.createWorkflow(req)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a workflow (name, description, isActive)")
    public ResponseEntity<ApiResponse<WorkflowResponse>> updateWorkflow(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWorkflowRequest req
    ) {
        return ResponseEntity.ok(ApiResponse.ok(workflowService.updateWorkflow(id, req)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a workflow and all its versions")
    public ResponseEntity<ApiResponse<Void>> deleteWorkflow(@PathVariable UUID id) {
        workflowService.deleteWorkflow(id);
        return ResponseEntity.ok(ApiResponse.ok("Workflow deleted"));
    }

    // ── Version CRUD ──────────────────────────────────────────────────────────

    @GetMapping("/{workflowId}/versions")
    @Operation(summary = "List all versions of a workflow (newest first)")
    public ResponseEntity<ApiResponse<List<WorkflowVersionResponse>>> listVersions(
            @PathVariable UUID workflowId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(workflowVersionService.listVersions(workflowId)));
    }

    @GetMapping("/{workflowId}/versions/{versionId}")
    @Operation(summary = "Get a specific workflow version")
    public ResponseEntity<ApiResponse<WorkflowVersionResponse>> getVersion(
            @PathVariable UUID workflowId,
            @PathVariable UUID versionId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(workflowVersionService.getVersion(workflowId, versionId)));
    }

    @PostMapping("/{workflowId}/versions")
    @Operation(summary = "Create a new workflow version. Set isActive=true to activate immediately.")
    public ResponseEntity<ApiResponse<WorkflowVersionResponse>> createVersion(
            @PathVariable UUID workflowId,
            @Valid @RequestBody CreateWorkflowVersionRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(workflowVersionService.createVersion(workflowId, req)));
    }

    @PutMapping("/{workflowId}/versions/{versionId}")
    @Operation(summary = "Update a workflow version. Set isActive=true to activate it.")
    public ResponseEntity<ApiResponse<WorkflowVersionResponse>> updateVersion(
            @PathVariable UUID workflowId,
            @PathVariable UUID versionId,
            @Valid @RequestBody UpdateWorkflowVersionRequest req
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
                workflowVersionService.updateVersion(workflowId, versionId, req)));
    }

    @DeleteMapping("/{workflowId}/versions/{versionId}")
    @Operation(summary = "Delete a workflow version")
    public ResponseEntity<ApiResponse<Void>> deleteVersion(
            @PathVariable UUID workflowId,
            @PathVariable UUID versionId
    ) {
        workflowVersionService.deleteVersion(workflowId, versionId);
        return ResponseEntity.ok(ApiResponse.ok("Workflow version deleted"));
    }
}
