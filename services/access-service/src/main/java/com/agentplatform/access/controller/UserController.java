package com.agentplatform.access.controller;

import com.agentplatform.access.dto.ApiResponse;
import com.agentplatform.access.dto.ChangePasswordRequest;
import com.agentplatform.access.dto.MembershipResponse;
import com.agentplatform.access.dto.UpdateUserRequest;
import com.agentplatform.access.dto.UserResponse;
import com.agentplatform.access.security.SecurityUtils;
import com.agentplatform.access.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User management")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "List users", description = "Paginated list with optional search by name or email")
    public ResponseEntity<ApiResponse<Page<UserResponse>>> listUsers(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Filter by name or email", example = "alice")
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.ok(userService.listUsers(search, pageable)));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user")
    public ResponseEntity<ApiResponse<UserResponse>> getMe(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUser(SecurityUtils.currentUserId())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID")
    public ResponseEntity<ApiResponse<UserResponse>> getUser(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUser(id)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update user")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserRequest req
    ) {
        return ResponseEntity.ok(ApiResponse.ok(userService.updateUser(id, req)));
    }

    @PutMapping("/{id}/password")
    @Operation(summary = "Change user password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ChangePasswordRequest req
    ) {
        userService.changePassword(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Password changed successfully"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.ok("User deleted successfully"));
    }

    @GetMapping("/{id}/memberships")
    @Operation(summary = "Get user's tenant memberships")
    public ResponseEntity<ApiResponse<List<MembershipResponse>>> getUserMemberships(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserMemberships(id)));
    }
}
