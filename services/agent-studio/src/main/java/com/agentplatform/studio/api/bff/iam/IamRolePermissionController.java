package com.agentplatform.studio.api.bff.iam;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.service.IamProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * BFF proxy for IAM role and permission management.
 */
@RestController
@RequiredArgsConstructor
public class IamRolePermissionController {

    private final IamProxyService iamProxy;

    // ── Roles ─────────────────────────────────────────────────────────────────

    @GetMapping("/api/v1/roles")
    public JsonNode listRoles(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/roles");
    }

    @GetMapping("/api/v1/roles/{roleId}")
    public JsonNode getRole(@AuthenticationPrincipal AuthContext auth,
                            @PathVariable String roleId) {
        return iamProxy.authGet("/roles/" + roleId);
    }

    @PostMapping("/api/v1/roles")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createRole(@AuthenticationPrincipal AuthContext auth,
                               @RequestBody JsonNode body) {
        return iamProxy.authPost("/roles", body);
    }

    @PatchMapping("/api/v1/roles/{roleId}")
    public JsonNode updateRole(@AuthenticationPrincipal AuthContext auth,
                               @PathVariable String roleId,
                               @RequestBody JsonNode body) {
        return iamProxy.authPatch("/roles/" + roleId, body);
    }

    @DeleteMapping("/api/v1/roles/{roleId}")
    public JsonNode deleteRole(@AuthenticationPrincipal AuthContext auth,
                               @PathVariable String roleId) {
        return iamProxy.authDelete("/roles/" + roleId);
    }

    @GetMapping("/api/v1/roles/{roleId}/permissions")
    public JsonNode listRolePermissions(@AuthenticationPrincipal AuthContext auth,
                                        @PathVariable String roleId) {
        return iamProxy.authGet("/roles/" + roleId + "/permissions");
    }

    @PostMapping("/api/v1/roles/{roleId}/permissions")
    public JsonNode assignRolePermission(@AuthenticationPrincipal AuthContext auth,
                                         @PathVariable String roleId,
                                         @RequestBody JsonNode body) {
        return iamProxy.authPost("/roles/" + roleId + "/permissions", body);
    }

    @DeleteMapping("/api/v1/roles/{roleId}/permissions/{permissionId}")
    public JsonNode revokeRolePermission(@AuthenticationPrincipal AuthContext auth,
                                         @PathVariable String roleId,
                                         @PathVariable String permissionId) {
        return iamProxy.authDelete("/roles/" + roleId + "/permissions/" + permissionId);
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    @GetMapping("/api/v1/permissions")
    public JsonNode listPermissions(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/permissions");
    }

    @PostMapping("/api/v1/permissions")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createPermission(@AuthenticationPrincipal AuthContext auth,
                                     @RequestBody JsonNode body) {
        return iamProxy.authPost("/permissions", body);
    }

    @DeleteMapping("/api/v1/permissions/{id}")
    public JsonNode deletePermission(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable String id) {
        return iamProxy.authDelete("/permissions/" + id);
    }

    @GetMapping("/api/v1/permissions/me")
    public JsonNode myPermissions(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/permissions/me");
    }
}
