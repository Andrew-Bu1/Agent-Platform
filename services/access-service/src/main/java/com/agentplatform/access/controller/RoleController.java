package com.agentplatform.access.controller;

import com.agentplatform.access.dto.*;
import com.agentplatform.access.service.RoleService;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
@Tag(name = "Roles", description = "Role management")
public class RoleController {

    private final RoleService roleService;

    @GetMapping
    @Operation(summary = "List roles")
    public ResponseEntity<Page<RoleResponse>> listRoles(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Search by name or description", example = "admin")
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ResponseEntity.ok(roleService.listRoles(search, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get role by ID")
    public ResponseEntity<RoleResponse> getRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        return ResponseEntity.ok(roleService.getRole(id));
    }

    @PostMapping
    @Operation(summary = "Create a role")
    public ResponseEntity<RoleResponse> createRole(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateRoleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roleService.createRole(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a role")
    public ResponseEntity<RoleResponse> updateRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(roleService.updateRole(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a role")
    public ResponseEntity<ApiResponse> deleteRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        roleService.deleteRole(id);
        return ResponseEntity.ok(ApiResponse.ok("Role deleted"));
    }

    @PostMapping("/{id}/permissions")
    @Operation(summary = "Assign permissions to a role")
    public ResponseEntity<RoleResponse> assignPermissions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody AssignPermissionsRequest request) {
        return ResponseEntity.ok(roleService.assignPermissions(id, request));
    }

    @DeleteMapping("/{id}/permissions/{permissionId}")
    @Operation(summary = "Remove a permission from a role")
    public ResponseEntity<RoleResponse> removePermission(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID permissionId) {
        return ResponseEntity.ok(roleService.removePermission(id, permissionId));
    }

    @GetMapping("/memberships/{membershipId}")
    @Operation(summary = "Get roles assigned to a membership")
    public ResponseEntity<List<RoleResponse>> getMembershipRoles(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID membershipId) {
        return ResponseEntity.ok(roleService.getMembershipRoles(membershipId));
    }

    @PostMapping("/memberships/{membershipId}/roles/{roleId}")
    @Operation(summary = "Assign a role to a membership")
    public ResponseEntity<ApiResponse> assignRoleToMembership(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID membershipId,
            @PathVariable UUID roleId) {
        roleService.assignRoleToMembership(membershipId, roleId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Role assigned to membership"));
    }

    @DeleteMapping("/memberships/{membershipId}/roles/{roleId}")
    @Operation(summary = "Remove a role from a membership")
    public ResponseEntity<ApiResponse> removeRoleFromMembership(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID membershipId,
            @PathVariable UUID roleId) {
        roleService.removeRoleFromMembership(membershipId, roleId);
        return ResponseEntity.ok(ApiResponse.ok("Role removed from membership"));
    }
}
