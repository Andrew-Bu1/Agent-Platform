package com.agentplatform.access.controller;

import com.agentplatform.access.dto.*;
import com.agentplatform.access.service.PermissionService;
import com.agentplatform.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/permissions")
@RequiredArgsConstructor
@Tag(name = "Permissions", description = "Permission management")
public class PermissionController {

    private final PermissionService permissionService;

    @GetMapping
    @Operation(summary = "List permissions")
    public ResponseEntity<Page<PermissionResponse>> listPermissions(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Search by resource, action, or description", example = "users")
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "resource") Pageable pageable) {
        return ResponseEntity.ok(permissionService.listPermissions(search, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get permission by ID")
    public ResponseEntity<PermissionResponse> getPermission(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        return ResponseEntity.ok(permissionService.getPermission(id));
    }

    @PostMapping
    @Operation(summary = "Create a permission")
    public ResponseEntity<PermissionResponse> createPermission(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreatePermissionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(permissionService.createPermission(request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a permission")
    public ResponseEntity<ApiResponse> deletePermission(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        permissionService.deletePermission(id);
        return ResponseEntity.ok(ApiResponse.ok("Permission deleted"));
    }
}
