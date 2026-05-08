package com.agentplatform.iam.api.tenant;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.api.auth.TokenResponse;
import com.agentplatform.iam.service.AuthService;
import com.agentplatform.iam.service.TenantService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/tenants")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;
    private final AuthService   authService;

    @Value("${app.jwt.access-token-ttl-seconds:3600}")
    private long accessTokenTtlSeconds;

    // ── Bootstrap (public — new user with no tenant yet) ──────────────────────

    /**
     * Called by a freshly registered user (requireTenantCreation=true from /auth/login).
     * Creates the user's first tenant + workspace and returns full access/refresh tokens
     * so the client is immediately logged in.
     */
    @PostMapping("/bootstrap")
    public ResponseEntity<ApiResponse<TokenResponse>> bootstrap(
            @Valid @RequestBody BootstrapTenantRequest req,
            HttpServletRequest httpReq) {

        // Resolve userId from pre_auth token (verified inside switchContext too)
        UUID userId = authService.resolvePreAuthUserId(req.preAuthToken());

        TenantService.TenantCreated created = tenantService.createTenant(
                userId,
                req.tenantCode(), req.tenantName(),
                req.workspaceCode(), req.workspaceName());

        // Re-use switchContext: verifies the same pre_auth token, checks memberships
        // (just created above), and issues access + refresh tokens.
        AuthService.TokensIssued tokens = authService.switchContext(
                req.preAuthToken(),
                created.tenant().getId(),
                created.workspace().getId(),
                httpReq.getRemoteAddr(),
                httpReq.getHeader("User-Agent"));

        TokenResponse body = new TokenResponse(
                tokens.accessToken(), tokens.refreshToken(), accessTokenTtlSeconds,
                tokens.userId(), tokens.tenantId(), tokens.workspaceId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(body));
    }

    // ── Tenant CRUD (authenticated) ───────────────────────────────────────────

    @GetMapping
    public ResponseEntity<ApiResponse<List<TenantDto>>> listTenants(
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        List<TenantDto> dtos = tenantService.listUserTenants(userId).stream()
                .map(t -> new TenantDto(t.getId(), t.getCode(), t.getName(), t.getStatus(), t.getPlanKey()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TenantDto>> createTenant(
            @Valid @RequestBody CreateTenantRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        TenantService.TenantCreated created = tenantService.createTenant(
                userId, req.code(), req.name(), req.workspaceCode(), req.workspaceName());
        var t = created.tenant();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(new TenantDto(t.getId(), t.getCode(), t.getName(), t.getStatus(), t.getPlanKey())));
    }

    @GetMapping("/{tenantId}")
    public ResponseEntity<ApiResponse<TenantDto>> getTenant(
            @PathVariable UUID tenantId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        var t = tenantService.getTenant(userId, tenantId);
        return ResponseEntity.ok(ApiResponse.ok(
                new TenantDto(t.getId(), t.getCode(), t.getName(), t.getStatus(), t.getPlanKey())));
    }

    @PatchMapping("/{tenantId}")
    public ResponseEntity<ApiResponse<TenantDto>> updateTenant(
            @PathVariable UUID tenantId,
            @Valid @RequestBody UpdateTenantRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        var t = tenantService.updateTenant(userId, tenantId, req.name());
        return ResponseEntity.ok(ApiResponse.ok(
                new TenantDto(t.getId(), t.getCode(), t.getName(), t.getStatus(), t.getPlanKey())));
    }

    @DeleteMapping("/{tenantId}")
    public ResponseEntity<ApiResponse<Void>> deleteTenant(
            @PathVariable UUID tenantId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        tenantService.deactivateTenant(userId, tenantId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── Workspace CRUD (authenticated) ────────────────────────────────────────

    @GetMapping("/{tenantId}/workspaces")
    public ResponseEntity<ApiResponse<List<WorkspaceDto>>> listWorkspaces(
            @PathVariable UUID tenantId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        List<WorkspaceDto> dtos = tenantService.listTenantWorkspaces(userId, tenantId).stream()
                .map(WorkspaceDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @GetMapping("/{tenantId}/workspaces/{workspaceId}")
    public ResponseEntity<ApiResponse<WorkspaceDto>> getWorkspace(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        var w = tenantService.getWorkspace(userId, tenantId, workspaceId);
        return ResponseEntity.ok(ApiResponse.ok(WorkspaceDto.from(w)));
    }

    @PostMapping("/{tenantId}/workspaces")
    public ResponseEntity<ApiResponse<WorkspaceDto>> createWorkspace(
            @PathVariable UUID tenantId,
            @Valid @RequestBody CreateWorkspaceRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        var w = tenantService.createWorkspace(userId, tenantId, req.code(), req.name(), req.description());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(WorkspaceDto.from(w)));
    }

    @PatchMapping("/{tenantId}/workspaces/{workspaceId}")
    public ResponseEntity<ApiResponse<WorkspaceDto>> updateWorkspace(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody UpdateWorkspaceRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        var w = tenantService.updateWorkspace(userId, tenantId, workspaceId, req.name(), req.description());
        return ResponseEntity.ok(ApiResponse.ok(WorkspaceDto.from(w)));
    }

    @DeleteMapping("/{tenantId}/workspaces/{workspaceId}")
    public ResponseEntity<ApiResponse<Void>> deleteWorkspace(
            @PathVariable UUID tenantId,
            @PathVariable UUID workspaceId,
            @AuthenticationPrincipal AuthContext ctx) {

        UUID userId = UUID.fromString(ctx.userId());
        tenantService.deactivateWorkspace(userId, tenantId, workspaceId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}

