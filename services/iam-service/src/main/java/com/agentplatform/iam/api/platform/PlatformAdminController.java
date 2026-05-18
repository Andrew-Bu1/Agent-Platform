package com.agentplatform.iam.api.platform;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.api.entitlement.GrantFeatureRequest;
import com.agentplatform.iam.api.entitlement.GrantModelEntitlementRequest;
import com.agentplatform.iam.api.entitlement.UpdateFeatureEntitlementRequest;
import com.agentplatform.iam.api.entitlement.UpdateModelEntitlementRequest;
import com.agentplatform.iam.api.permission.PermissionDto;
import com.agentplatform.iam.api.role.RoleDto;
import com.agentplatform.iam.api.tenant.TenantDto;
import com.agentplatform.iam.api.tenant.WorkspaceDto;
import com.agentplatform.iam.entity.FeatureEntitlement;
import com.agentplatform.iam.entity.ModelEntitlement;
import com.agentplatform.iam.service.EntitlementService;
import com.agentplatform.iam.service.PermissionService;
import com.agentplatform.iam.service.RoleService;
import com.agentplatform.iam.service.TenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/platform")
@RequiredArgsConstructor
public class PlatformAdminController {

    private final TenantService tenantService;
    private final EntitlementService entitlementService;
    private final RoleService roleService;
    private final PermissionService permissionService;

    @GetMapping("/tenants")
    public ResponseEntity<ApiResponse<List<TenantDto>>> listTenants(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID userId = UUID.fromString(ctx.userId());
        List<TenantDto> tenants = tenantService.listAllTenantsForPlatformAdmin(userId).stream()
                .map(t -> new TenantDto(t.getId(), t.getCode(), t.getName(), t.getStatus(), t.getPlanKey()))
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(tenants));
    }

    @GetMapping("/tenants/{tenantId}/workspaces")
    public ResponseEntity<ApiResponse<List<WorkspaceDto>>> listWorkspaces(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId) {
        UUID userId = UUID.fromString(ctx.userId());
        return ResponseEntity.ok(ApiResponse.ok(
                tenantService.listTenantWorkspacesForPlatformAdmin(userId, tenantId).stream()
                        .map(WorkspaceDto::from)
                        .toList()));
    }

    @GetMapping("/tenants/{tenantId}/entitlements/features")
    public ResponseEntity<ApiResponse<List<FeatureEntitlement>>> listFeatureEntitlements(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId) {
        UUID userId = UUID.fromString(ctx.userId());
        tenantService.requirePlatformAdmin(userId);
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.listFeatureEntitlements(tenantId)));
    }

    @PostMapping("/tenants/{tenantId}/entitlements/features")
    public ResponseEntity<ApiResponse<FeatureEntitlement>> grantFeature(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId,
            @Valid @RequestBody GrantFeatureRequest req) {
        UUID userId = UUID.fromString(ctx.userId());
        FeatureEntitlement result = entitlementService.grantFeatureEntitlement(
                userId, tenantId, req.featureKey(), Boolean.TRUE.equals(req.enabled()), req.config());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    @PatchMapping("/tenants/{tenantId}/entitlements/features/{featureId}")
    public ResponseEntity<ApiResponse<FeatureEntitlement>> updateFeature(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId,
            @PathVariable UUID featureId,
            @RequestBody UpdateFeatureEntitlementRequest req) {
        UUID userId = UUID.fromString(ctx.userId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.updateFeatureEntitlement(
                userId, tenantId, featureId, Boolean.TRUE.equals(req.enabled()), req.config())));
    }

    @DeleteMapping("/tenants/{tenantId}/entitlements/features/{featureId}")
    public ResponseEntity<ApiResponse<Void>> revokeFeature(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId,
            @PathVariable UUID featureId) {
        UUID userId = UUID.fromString(ctx.userId());
        entitlementService.revokeFeatureEntitlement(userId, tenantId, featureId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/tenants/{tenantId}/entitlements/models")
    public ResponseEntity<ApiResponse<List<ModelEntitlement>>> listModelEntitlements(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId) {
        UUID userId = UUID.fromString(ctx.userId());
        tenantService.requirePlatformAdmin(userId);
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.listModelEntitlements(tenantId)));
    }

    @PostMapping("/tenants/{tenantId}/entitlements/models")
    public ResponseEntity<ApiResponse<ModelEntitlement>> grantModel(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId,
            @Valid @RequestBody GrantModelEntitlementRequest req) {
        UUID userId = UUID.fromString(ctx.userId());
        ModelEntitlement result = entitlementService.grantModelEntitlement(
                userId, tenantId, req.modelKey(), req.operationType(), Boolean.TRUE.equals(req.allowed()),
                req.rpmLimit(), req.tpmLimit(), req.dailyTokenLimit(), req.monthlyTokenLimit(), req.config());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    @PatchMapping("/tenants/{tenantId}/entitlements/models/{id}")
    public ResponseEntity<ApiResponse<ModelEntitlement>> updateModel(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId,
            @PathVariable UUID id,
            @RequestBody UpdateModelEntitlementRequest req) {
        UUID userId = UUID.fromString(ctx.userId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.updateModelEntitlement(
                userId, tenantId, id, req.allowed(), req.rpmLimit(), req.tpmLimit(),
                req.dailyTokenLimit(), req.monthlyTokenLimit(), req.config())));
    }

    @DeleteMapping("/tenants/{tenantId}/entitlements/models/{id}")
    public ResponseEntity<ApiResponse<Void>> revokeModel(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId,
            @PathVariable UUID id) {
        UUID userId = UUID.fromString(ctx.userId());
        entitlementService.revokeModelEntitlement(userId, tenantId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── Roles (read-only cross-tenant view) ───────────────────────────────────

    /**
     * Lists all roles visible to {@code tenantId} — platform system roles plus any
     * custom roles the tenant has defined. Requires {@code platform_admin}.
     */
    @GetMapping("/tenants/{tenantId}/roles")
    public ResponseEntity<ApiResponse<List<RoleDto>>> listTenantRoles(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId) {
        UUID userId = UUID.fromString(ctx.userId());
        List<RoleDto> dtos = roleService.listRolesForPlatformAdmin(userId, tenantId)
                .stream().map(RoleDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    // ── Permissions (read-only cross-tenant view) ─────────────────────────────

    /**
     * Lists all permissions visible to {@code tenantId} — platform system permissions
     * plus any custom permissions the tenant has defined. Requires {@code platform_admin}.
     */
    @GetMapping("/tenants/{tenantId}/permissions")
    public ResponseEntity<ApiResponse<List<PermissionDto>>> listTenantPermissions(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID tenantId) {
        UUID userId = UUID.fromString(ctx.userId());
        List<PermissionDto> dtos = permissionService.listPermissionsForPlatformAdmin(userId, tenantId)
                .stream().map(PermissionDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }
}
