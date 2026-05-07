package com.agentplatform.iam.api.auth;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.entity.IamUser;
import com.agentplatform.iam.service.AuthService;
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

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${app.jwt.access-token-ttl-seconds:3600}")
    private long accessTokenTtlSeconds;

    // ── Sign up ────────────────────────────────────────────────────────────────

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<SignupResponse>> signup(
            @Valid @RequestBody SignupRequest req) {

        AuthService.SignupResult result = authService.signup(req.name(), req.email(), req.password());
        SignupResponse body = new SignupResponse(result.userId(), result.email(), result.name());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(body));
    }

    // ── Log in (email + password → preAuthToken) ───────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest req) {

        AuthService.LoginResult r = authService.login(req.email(), req.password());
        LoginResponse body = new LoginResponse(
                r.preAuthToken(), r.requireTenantCreation(), r.requireTenantSelection(),
                r.singleTenantId(), r.tenants());
        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    // ── List workspaces for a chosen tenant ───────────────────────────────────

    @PostMapping("/workspaces")
    public ResponseEntity<ApiResponse<List<WorkspaceInfo>>> workspaces(
            @Valid @RequestBody WorkspacesRequest req) {

        List<WorkspaceInfo> list = authService.listWorkspaces(req.preAuthToken(), req.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    // ── Switch context (tenant + workspace → full JWT) ─────────────────────────

    @PostMapping("/switch-context")
    public ResponseEntity<ApiResponse<TokenResponse>> switchContext(
            @Valid @RequestBody SwitchContextRequest req,
            HttpServletRequest httpReq) {

        AuthService.TokensIssued r = authService.switchContext(
                req.preAuthToken(), req.tenantId(), req.workspaceId(),
                httpReq.getRemoteAddr(),
                httpReq.getHeader("User-Agent"));

        TokenResponse body = new TokenResponse(
                r.accessToken(), r.refreshToken(),
                accessTokenTtlSeconds, r.userId(), r.tenantId(), r.workspaceId());
        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    // ── Refresh ─────────────────────────────────────────────────────────────────────

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            @Valid @RequestBody RefreshRequest req,
            HttpServletRequest httpReq) {

        AuthService.TokensIssued r = authService.refresh(
                req.refreshToken(),
                httpReq.getRemoteAddr(),
                httpReq.getHeader("User-Agent"));

        TokenResponse body = new TokenResponse(
                r.accessToken(), r.refreshToken(),
                accessTokenTtlSeconds, r.userId(), r.tenantId(), r.workspaceId());
        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    // ── Logout ─────────────────────────────────────────────────────────────────

    /** Revoke all sessions — log out from every device. */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@AuthenticationPrincipal AuthContext ctx) {
        authService.logout(ctx);
        return ResponseEntity.ok(ApiResponse.ok());
    }

    // ── Me ─────────────────────────────────────────────────────────────────────

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<MeResponse>> me(@AuthenticationPrincipal AuthContext ctx) {
        IamUser user = authService.me(ctx);
        MeResponse body = new MeResponse(
                user.getId(), user.getEmail(), user.getName(), user.getAvatarUrl(),
                ctx.tenantId(), ctx.workspaceId());
        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    // ── Change password ─────────────────────────────────────────────────────────

    @PatchMapping("/me/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest req,
            @AuthenticationPrincipal AuthContext ctx) {

        authService.changePassword(UUID.fromString(ctx.userId()), req.currentPassword(), req.newPassword());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}

