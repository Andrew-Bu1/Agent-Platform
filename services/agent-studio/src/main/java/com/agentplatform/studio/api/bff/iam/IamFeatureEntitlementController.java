package com.agentplatform.studio.api.bff.iam;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.service.IamProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class IamFeatureEntitlementController {

    private final IamProxyService iamProxy;

    @GetMapping("/api/v1/features")
    public JsonNode listFeatures(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/features");
    }

    @PostMapping("/api/v1/features")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createFeature(@AuthenticationPrincipal AuthContext auth,
                                  @RequestBody JsonNode body) {
        return iamProxy.authPost("/features", body);
    }

    @PatchMapping("/api/v1/features/{id}")
    public JsonNode updateFeature(@AuthenticationPrincipal AuthContext auth,
                                  @PathVariable String id,
                                  @RequestBody JsonNode body) {
        return iamProxy.authPatch("/features/" + id, body);
    }

    @DeleteMapping("/api/v1/features/{id}")
    public JsonNode deleteFeature(@AuthenticationPrincipal AuthContext auth,
                                  @PathVariable String id) {
        return iamProxy.authDelete("/features/" + id);
    }

    @GetMapping("/api/v1/platform/tenants")
    public JsonNode listPlatformTenants(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/platform/tenants");
    }

    @GetMapping("/api/v1/platform/tenants/{tenantId}/workspaces")
    public JsonNode listPlatformTenantWorkspaces(@AuthenticationPrincipal AuthContext auth,
                                                 @PathVariable String tenantId) {
        return iamProxy.authGet("/platform/tenants/" + tenantId + "/workspaces");
    }

    @GetMapping("/api/v1/platform/tenants/{tenantId}/entitlements/features")
    public JsonNode listFeatureEntitlements(@AuthenticationPrincipal AuthContext auth,
                                            @PathVariable String tenantId) {
        return iamProxy.authGet("/platform/tenants/" + tenantId + "/entitlements/features");
    }

    @PostMapping("/api/v1/platform/tenants/{tenantId}/entitlements/features")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode grantFeature(@AuthenticationPrincipal AuthContext auth,
                                 @PathVariable String tenantId,
                                 @RequestBody JsonNode body) {
        return iamProxy.authPost("/platform/tenants/" + tenantId + "/entitlements/features", body);
    }

    @PatchMapping("/api/v1/platform/tenants/{tenantId}/entitlements/features/{featureId}")
    public JsonNode updateFeatureEntitlement(@AuthenticationPrincipal AuthContext auth,
                                             @PathVariable String tenantId,
                                             @PathVariable String featureId,
                                             @RequestBody JsonNode body) {
        return iamProxy.authPatch("/platform/tenants/" + tenantId + "/entitlements/features/" + featureId, body);
    }

    @DeleteMapping("/api/v1/platform/tenants/{tenantId}/entitlements/features/{featureId}")
    public JsonNode revokeFeature(@AuthenticationPrincipal AuthContext auth,
                                  @PathVariable String tenantId,
                                  @PathVariable String featureId) {
        return iamProxy.authDelete("/platform/tenants/" + tenantId + "/entitlements/features/" + featureId);
    }

    @GetMapping("/api/v1/platform/tenants/{tenantId}/entitlements/models")
    public JsonNode listModelEntitlements(@AuthenticationPrincipal AuthContext auth,
                                          @PathVariable String tenantId) {
        return iamProxy.authGet("/platform/tenants/" + tenantId + "/entitlements/models");
    }

    @PostMapping("/api/v1/platform/tenants/{tenantId}/entitlements/models")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode grantModel(@AuthenticationPrincipal AuthContext auth,
                               @PathVariable String tenantId,
                               @RequestBody JsonNode body) {
        return iamProxy.authPost("/platform/tenants/" + tenantId + "/entitlements/models", body);
    }

    @PatchMapping("/api/v1/platform/tenants/{tenantId}/entitlements/models/{id}")
    public JsonNode updateModelEntitlement(@AuthenticationPrincipal AuthContext auth,
                                           @PathVariable String tenantId,
                                           @PathVariable String id,
                                           @RequestBody JsonNode body) {
        return iamProxy.authPatch("/platform/tenants/" + tenantId + "/entitlements/models/" + id, body);
    }

    @DeleteMapping("/api/v1/platform/tenants/{tenantId}/entitlements/models/{id}")
    public JsonNode revokeModel(@AuthenticationPrincipal AuthContext auth,
                                @PathVariable String tenantId,
                                @PathVariable String id) {
        return iamProxy.authDelete("/platform/tenants/" + tenantId + "/entitlements/models/" + id);
    }

    // ── Roles & Permissions (read-only cross-tenant view) ─────────────────────

    /**
     * Returns all roles visible to the given tenant (system roles + tenant custom roles).
     * Requires a {@code platform_admin} access token.
     */
    @GetMapping("/api/v1/platform/tenants/{tenantId}/roles")
    public JsonNode listTenantRoles(@AuthenticationPrincipal AuthContext auth,
                                    @PathVariable String tenantId) {
        return iamProxy.authGet("/platform/tenants/" + tenantId + "/roles");
    }

    /**
     * Returns all permissions visible to the given tenant (system permissions + tenant custom
     * permissions). Requires a {@code platform_admin} access token.
     */
    @GetMapping("/api/v1/platform/tenants/{tenantId}/permissions")
    public JsonNode listTenantPermissions(@AuthenticationPrincipal AuthContext auth,
                                          @PathVariable String tenantId) {
        return iamProxy.authGet("/platform/tenants/" + tenantId + "/permissions");
    }
}
