package com.agentplatform.access.controller;

import com.agentplatform.access.dto.ApiResponse;
import com.agentplatform.access.dto.CreateFeatureEntitlementRequest;
import com.agentplatform.access.dto.FeatureEntitlementResponse;
import com.agentplatform.access.dto.UpdateFeatureEntitlementRequest;
import com.agentplatform.access.service.FeatureEntitlementService;
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
@RequestMapping("/api/v1/tenants/{tenantId}/feature-entitlements")
@RequiredArgsConstructor
@Tag(name = "Feature Entitlements", description = "Tenant feature entitlement management")
public class FeatureEntitlementController {

    private final FeatureEntitlementService featureEntitlementService;

    @GetMapping
    @Operation(summary = "List feature entitlements for a tenant")
    public ResponseEntity<Page<FeatureEntitlementResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PageableDefault(size = 50, sort = "featureKey") Pageable pageable) {
        return ResponseEntity.ok(featureEntitlementService.listByTenant(tenantId, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a feature entitlement by ID")
    public ResponseEntity<FeatureEntitlementResponse> get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(featureEntitlementService.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a feature entitlement for a tenant")
    public ResponseEntity<FeatureEntitlementResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @Valid @RequestBody CreateFeatureEntitlementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(featureEntitlementService.create(tenantId, request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a feature entitlement")
    public ResponseEntity<FeatureEntitlementResponse> update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateFeatureEntitlementRequest request) {
        return ResponseEntity.ok(featureEntitlementService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a feature entitlement")
    public ResponseEntity<ApiResponse> delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @PathVariable UUID id) {
        featureEntitlementService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Feature entitlement deleted"));
    }
}
