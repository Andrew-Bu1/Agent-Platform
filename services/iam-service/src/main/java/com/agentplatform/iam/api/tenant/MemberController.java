package com.agentplatform.iam.api.tenant;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Tenant and workspace member management.
 *
 * <pre>
 *   GET    /tenants/{tenantId}/members
 *   POST   /tenants/{tenantId}/members
 *   DELETE /tenants/{tenantId}/members/{userId}
 *   POST   /tenants/{tenantId}/members/{userId}/roles
 *   DELETE /tenants/{tenantId}/members/{userId}/roles/{roleKey}
 *
 *   GET    /tenants/{tenantId}/workspaces/{workspaceId}/members
 *   POST   /tenants/{tenantId}/workspaces/{workspaceId}/members
 *   DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}
 *   POST   /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles
 *   DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles/{roleKey}
 * </pre>
 */
@RestController
@RequestMapping("/tenants")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    // ── Tenant members ────────────────────────────────────────────────────────

    @GetMapping("/{tenantId}/members")
    public ResponseEntity<ApiResponse<List<MemberService.TenantMemberDto>>> listTenantMembers(
            @PathVariable UUID tenantId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        return ResponseEntity.ok(ApiResponse.ok(memberService.listTenantMembers(userId, tenantId)));
    }

    @PostMapping("/{tenantId}/members")
    public ResponseEntity<ApiResponse<MemberService.TenantMemberDto>> inviteToTenant(
            @PathVariable UUID tenantId,
            @Valid @RequestBody InviteMemberRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        var member = memberService.inviteToTenant(userId, tenantId, req.email(), req.roleKey());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(member));
    }

    @DeleteMapping("/{tenantId}/members/{targetUserId}")
    public ResponseEntity<ApiResponse<Void>> removeFromTenant(
            @PathVariable UUID tenantId,
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        memberService.removeFromTenant(userId, tenantId, targetUserId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/{tenantId}/members/{targetUserId}/roles")
    public ResponseEntity<ApiResponse<Void>> assignTenantRole(
            @PathVariable UUID tenantId,
            @PathVariable UUID targetUserId,
            @Valid @RequestBody AssignRoleRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        memberService.assignTenantRole(userId, tenantId, targetUserId, req.roleKey());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @DeleteMapping("/{tenantId}/members/{targetUserId}/roles/{roleKey}")
    public ResponseEntity<ApiResponse<Void>> revokeTenantRole(
            @PathVariable UUID tenantId,
            @PathVariable UUID targetUserId,
            @PathVariable String roleKey,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        memberService.revokeTenantRole(userId, tenantId, targetUserId, roleKey);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── Workspace members ─────────────────────────────────────────────────────

    @GetMapping("/{tenantId}/workspaces/{workspaceId}/members")
    public ResponseEntity<ApiResponse<List<MemberService.WorkspaceMemberDto>>> listWorkspaceMembers(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        return ResponseEntity.ok(ApiResponse.ok(
                memberService.listWorkspaceMembers(userId, tenantId, workspaceId)));
    }

    @PostMapping("/{tenantId}/workspaces/{workspaceId}/members")
    public ResponseEntity<ApiResponse<MemberService.WorkspaceMemberDto>> inviteToWorkspace(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody InviteMemberRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        var member = memberService.inviteToWorkspace(userId, tenantId, workspaceId, req.email(), req.roleKey());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(member));
    }

    @DeleteMapping("/{tenantId}/workspaces/{workspaceId}/members/{targetUserId}")
    public ResponseEntity<ApiResponse<Void>> removeFromWorkspace(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        memberService.removeFromWorkspace(userId, tenantId, workspaceId, targetUserId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/{tenantId}/workspaces/{workspaceId}/members/{targetUserId}/roles")
    public ResponseEntity<ApiResponse<Void>> assignWorkspaceRole(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @PathVariable UUID targetUserId,
            @Valid @RequestBody AssignRoleRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        memberService.assignWorkspaceRole(userId, tenantId, workspaceId, targetUserId, req.roleKey());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @DeleteMapping("/{tenantId}/workspaces/{workspaceId}/members/{targetUserId}/roles/{roleKey}")
    public ResponseEntity<ApiResponse<Void>> revokeWorkspaceRole(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @PathVariable UUID targetUserId,
            @PathVariable String roleKey,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        memberService.revokeWorkspaceRole(userId, tenantId, workspaceId, targetUserId, roleKey);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
