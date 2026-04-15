package com.agentplatform.access.controller;

import com.agentplatform.access.dto.ApiResponse;
import com.agentplatform.access.dto.CreateModelEntitlementRequest;
import com.agentplatform.access.dto.ModelEntitlementResponse;
import com.agentplatform.access.dto.UpdateModelEntitlementRequest;
import com.agentplatform.access.service.ModelEntitlementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tenants/{tenantId}/model-entitlements")
@RequiredArgsConstructor
@Tag(name = "Model Entitlements", description = "Tenant AI model entitlement management")
public class ModelEntitlementController {

    private final ModelEntitlementService modelEntitlementService;

    @GetMapping
    @Operation(summary = "List model entitlements for a tenant")
    public ResponseEntity<Page<ModelEntitlementResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PageableDefault(size = 50, sort = "modelKey") Pageable pageable) {
        return ResponseEntity.ok(modelEntitlementService.listByTenant(tenantId, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a model entitlement by ID")
    public ResponseEntity<ModelEntitlementResponse> get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(modelEntitlementService.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a model entitlement for a tenant")
    public ResponseEntity<ModelEntitlementResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @Valid @RequestBody CreateModelEntitlementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(modelEntitlementService.create(tenantId, request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a model entitlement")
    public ResponseEntity<ModelEntitlementResponse> update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateModelEntitlementRequest request) {
        return ResponseEntity.ok(modelEntitlementService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a model entitlement")
    public ResponseEntity<ApiResponse> delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PathVariable UUID id) {
        modelEntitlementService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Model entitlement deleted"));
    }
}
