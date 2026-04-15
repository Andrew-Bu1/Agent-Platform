package com.agentplatform.access.controller;

import com.agentplatform.access.dto.ApiResponse;
import com.agentplatform.access.dto.AuthResponse;
import com.agentplatform.access.dto.LoginRequest;
import com.agentplatform.access.dto.LogoutRequest;
import com.agentplatform.access.dto.SignupRequest;
import com.agentplatform.access.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<AuthResponse>> signup(
            @Valid @RequestBody SignupRequest req,
            HttpServletRequest httpRequest
    ) {
        AuthResponse auth = authService.signup(
                req,
                httpRequest.getHeader("User-Agent"),
                httpRequest.getRemoteAddr()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(auth));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest httpRequest
    ) {
        AuthResponse auth = authService.login(
                req,
                httpRequest.getHeader("User-Agent"),
                httpRequest.getRemoteAddr()
        );
        return ResponseEntity.ok(ApiResponse.ok(auth));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @Valid @RequestBody LogoutRequest req
    ) {
        authService.logout(req);
        return ResponseEntity.ok(ApiResponse.ok("Logged out successfully"));
    }
}
