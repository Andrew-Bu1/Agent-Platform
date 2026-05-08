package com.agentplatform.iam.api.entitlement;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.entity.FeatureEntitlement;
import com.agentplatform.iam.entity.ModelEntitlement;
import com.agentplatform.iam.service.EntitlementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/entitlements")
@RequiredArgsConstructor
public class EntitlementController {

    private final EntitlementService entitlementService;

    // ── Feature entitlements ──────────────────────────────────────────────────

    @GetMapping("/features")
    public ResponseEntity<ApiResponse<List<EntitlementService.FeatureEntitlementView>>> features(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.getFeatureEntitlements(tenantId)));
    }

    @GetMapping("/features/all")
    public ResponseEntity<ApiResponse<List<FeatureEntitlement>>> listFeatures(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.listFeatureEntitlements(tenantId)));
    }

    @PostMapping("/features")
    public ResponseEntity<ApiResponse<FeatureEntitlement>> grantFeature(
            @AuthenticationPrincipal AuthContext ctx,
            @Valid @RequestBody GrantFeatureRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        boolean enabled = Boolean.TRUE.equals(req.enabled());
        FeatureEntitlement result = entitlementService.grantFeatureEntitlement(
                userId, tenantId, req.featureKey(), enabled, req.config());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    @PatchMapping("/features/{featureId}")
    public ResponseEntity<ApiResponse<FeatureEntitlement>> updateFeature(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID featureId,
            @RequestBody UpdateFeatureEntitlementRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        boolean enabled = Boolean.TRUE.equals(req.enabled());
        return ResponseEntity.ok(ApiResponse.ok(
                entitlementService.updateFeatureEntitlement(userId, tenantId, featureId, enabled, req.config())));
    }

    @DeleteMapping("/features/{featureId}")
    public ResponseEntity<ApiResponse<Void>> revokeFeature(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID featureId) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        entitlementService.revokeFeatureEntitlement(userId, tenantId, featureId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── Model entitlements ────────────────────────────────────────────────────

    @GetMapping("/models")
    public ResponseEntity<ApiResponse<List<EntitlementService.ModelEntitlementView>>> models(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.getModelEntitlements(tenantId)));
    }

    @GetMapping("/models/all")
    public ResponseEntity<ApiResponse<List<ModelEntitlement>>> listModels(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.listModelEntitlements(tenantId)));
    }

    @PostMapping("/models")
    public ResponseEntity<ApiResponse<ModelEntitlement>> grantModel(
            @AuthenticationPrincipal AuthContext ctx,
            @Valid @RequestBody GrantModelEntitlementRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        boolean allowed = Boolean.TRUE.equals(req.allowed());
        ModelEntitlement result = entitlementService.grantModelEntitlement(
                userId, tenantId, req.modelKey(), req.operationType(), allowed,
                req.rpmLimit(), req.tpmLimit(),
                req.dailyTokenLimit(), req.monthlyTokenLimit(), req.config());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    @PatchMapping("/models/{id}")
    public ResponseEntity<ApiResponse<ModelEntitlement>> updateModel(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id,
            @RequestBody UpdateModelEntitlementRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(
                entitlementService.updateModelEntitlement(
                        userId, tenantId, id, req.allowed(),
                        req.rpmLimit(), req.tpmLimit(),
                        req.dailyTokenLimit(), req.monthlyTokenLimit(), req.config())));
    }

    @DeleteMapping("/models/{id}")
    public ResponseEntity<ApiResponse<Void>> revokeModel(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        entitlementService.revokeModelEntitlement(userId, tenantId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
