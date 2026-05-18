package com.agentplatform.studio.api.bff.iam;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.service.IamProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * BFF proxy for IAM authentication endpoints.
 * Public endpoints (login, signup, refresh, switch-context, workspaces) are
 * listed in {@code SecurityConfig} as permit-all.
 * Authenticated endpoints (logout, me, change-password) require a valid JWT.
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class IamAuthController {

    private final IamProxyService iamProxy;

    // ── Public ────────────────────────────────────────────────────────────────

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode signup(@Valid @RequestBody JsonNode body) {
        return iamProxy.publicPost("/auth/signup", body);
    }

    @PostMapping("/login")
    public JsonNode login(@Valid @RequestBody JsonNode body) {
        return iamProxy.publicPost("/auth/login", body);
    }

    @PostMapping("/workspaces")
    public JsonNode listWorkspaces(@RequestBody JsonNode body) {
        return iamProxy.publicPost("/auth/workspaces", body);
    }

    @PostMapping("/switch-context")
    public JsonNode switchContext(@RequestBody JsonNode body) {
        return iamProxy.publicPost("/auth/switch-context", body);
    }

    @PostMapping("/refresh")
    public JsonNode refresh(@RequestBody JsonNode body) {
        return iamProxy.publicPost("/auth/refresh", body);
    }

    /** Logout current session (revokes only the provided refresh token). */
    @PostMapping("/logout/session")
    public JsonNode logoutSession(@RequestBody JsonNode body) {
        return iamProxy.publicPost("/auth/logout/session", body);
    }

    // ── Authenticated ─────────────────────────────────────────────────────────

    /** Logout all sessions for the current user. */
    @PostMapping("/logout")
    public JsonNode logout(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authPost("/auth/logout", null);
    }

    /** Switch to a different tenant + workspace while already authenticated. */
    @PostMapping("/switch")
    public JsonNode switchWorkspace(@AuthenticationPrincipal AuthContext auth,
                                    @RequestBody JsonNode body) {
        return iamProxy.authPost("/auth/switch", body);
    }

    @GetMapping("/me")
    public JsonNode me(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/auth/me");
    }

    @PatchMapping("/me/password")
    public JsonNode changePassword(@AuthenticationPrincipal AuthContext auth,
                                   @RequestBody JsonNode body) {
        return iamProxy.authPost("/auth/me/password", body);
    }
}
