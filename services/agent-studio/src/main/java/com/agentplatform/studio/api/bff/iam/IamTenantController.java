package com.agentplatform.studio.api.bff.iam;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.service.IamProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * BFF proxy for IAM tenant and workspace management endpoints.
 * All routes require authentication (bearer forwarded to IAM).
 */
@RestController
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
public class IamTenantController {

    private final IamProxyService iamProxy;

    // ── Tenant bootstrap (public — pre_auth token is passed in body) ──────────

    @PostMapping("/bootstrap")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode bootstrap(@RequestBody JsonNode body) {
        return iamProxy.publicPost("/tenants/bootstrap", body);
    }

    // ── Tenants ───────────────────────────────────────────────────────────────

    @GetMapping
    public JsonNode listTenants(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/tenants");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createTenant(@AuthenticationPrincipal AuthContext auth,
                                 @Valid @RequestBody JsonNode body) {
        return iamProxy.authPost("/tenants", body);
    }

    @GetMapping("/{tenantId}")
    public JsonNode getTenant(@AuthenticationPrincipal AuthContext auth,
                              @PathVariable UUID tenantId) {
        return iamProxy.authGet("/tenants/" + tenantId);
    }

    // ── Tenant members ────────────────────────────────────────────────────────

    @GetMapping("/{tenantId}/members")
    public JsonNode listTenantMembers(@AuthenticationPrincipal AuthContext auth,
                                      @PathVariable UUID tenantId) {
        return iamProxy.authGet("/tenants/" + tenantId + "/members");
    }

    @PostMapping("/{tenantId}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode inviteToTenant(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID tenantId,
                                   @RequestBody JsonNode body) {
        return iamProxy.authPost("/tenants/" + tenantId + "/members", body);
    }

    @DeleteMapping("/{tenantId}/members/{userId}")
    public JsonNode removeFromTenant(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable UUID tenantId,
                                     @PathVariable UUID userId) {
        return iamProxy.authDelete("/tenants/" + tenantId + "/members/" + userId);
    }

    @PostMapping("/{tenantId}/members/{userId}/roles")
    public JsonNode assignTenantRole(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable UUID tenantId,
                                     @PathVariable UUID userId,
                                     @RequestBody JsonNode body) {
        return iamProxy.authPost("/tenants/" + tenantId + "/members/" + userId + "/roles", body);
    }

    @DeleteMapping("/{tenantId}/members/{userId}/roles/{roleKey}")
    public JsonNode removeTenantRole(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable UUID tenantId,
                                     @PathVariable UUID userId,
                                     @PathVariable String roleKey) {
        return iamProxy.authDelete("/tenants/" + tenantId + "/members/" + userId + "/roles/" + roleKey);
    }

    // ── Workspaces ────────────────────────────────────────────────────────────

    @GetMapping("/{tenantId}/workspaces")
    public JsonNode listWorkspaces(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID tenantId) {
        return iamProxy.authGet("/tenants/" + tenantId + "/workspaces");
    }

    @PostMapping("/{tenantId}/workspaces")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createWorkspace(@AuthenticationPrincipal AuthContext auth,
                                    @PathVariable UUID tenantId,
                                    @Valid @RequestBody JsonNode body) {
        return iamProxy.authPost("/tenants/" + tenantId + "/workspaces", body);
    }

    @GetMapping("/{tenantId}/workspaces/{workspaceId}")
    public JsonNode getWorkspace(@AuthenticationPrincipal AuthContext auth,
                                 @PathVariable UUID tenantId,
                                 @PathVariable UUID workspaceId) {
        return iamProxy.authGet("/tenants/" + tenantId + "/workspaces/" + workspaceId);
    }

    // ── Workspace members ─────────────────────────────────────────────────────

    @GetMapping("/{tenantId}/workspaces/{workspaceId}/members")
    public JsonNode listWorkspaceMembers(@AuthenticationPrincipal AuthContext auth,
                                         @PathVariable UUID tenantId,
                                         @PathVariable UUID workspaceId) {
        return iamProxy.authGet("/tenants/" + tenantId + "/workspaces/" + workspaceId + "/members");
    }

    @PostMapping("/{tenantId}/workspaces/{workspaceId}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode addWorkspaceMember(@AuthenticationPrincipal AuthContext auth,
                                       @PathVariable UUID tenantId,
                                       @PathVariable UUID workspaceId,
                                       @RequestBody JsonNode body) {
        return iamProxy.authPost("/tenants/" + tenantId + "/workspaces/" + workspaceId + "/members", body);
    }

    @DeleteMapping("/{tenantId}/workspaces/{workspaceId}/members/{userId}")
    public JsonNode removeWorkspaceMember(@AuthenticationPrincipal AuthContext auth,
                                          @PathVariable UUID tenantId,
                                          @PathVariable UUID workspaceId,
                                          @PathVariable UUID userId) {
        return iamProxy.authDelete("/tenants/" + tenantId + "/workspaces/" + workspaceId + "/members/" + userId);
    }

    @PostMapping("/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles")
    public JsonNode assignWorkspaceRole(@AuthenticationPrincipal AuthContext auth,
                                        @PathVariable UUID tenantId,
                                        @PathVariable UUID workspaceId,
                                        @PathVariable UUID userId,
                                        @RequestBody JsonNode body) {
        return iamProxy.authPost(
                "/tenants/" + tenantId + "/workspaces/" + workspaceId + "/members/" + userId + "/roles", body);
    }

    @DeleteMapping("/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles/{roleKey}")
    public JsonNode removeWorkspaceRole(@AuthenticationPrincipal AuthContext auth,
                                        @PathVariable UUID tenantId,
                                        @PathVariable UUID workspaceId,
                                        @PathVariable UUID userId,
                                        @PathVariable String roleKey) {
        return iamProxy.authDelete(
                "/tenants/" + tenantId + "/workspaces/" + workspaceId + "/members/" + userId + "/roles/" + roleKey);
    }
}
