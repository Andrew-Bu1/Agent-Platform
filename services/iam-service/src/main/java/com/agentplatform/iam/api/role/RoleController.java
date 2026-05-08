package com.agentplatform.iam.api.role;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.api.permission.PermissionDto;
import com.agentplatform.iam.service.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService roleService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<RoleDto>>> list(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        List<RoleDto> dtos = roleService.listRoles(tenantId)
                .stream().map(RoleDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @GetMapping("/{roleId}")
    public ResponseEntity<ApiResponse<RoleDto>> get(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID roleId) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(
                RoleDto.from(roleService.getRole(tenantId, roleId))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RoleDto>> create(
            @AuthenticationPrincipal AuthContext ctx,
            @Valid @RequestBody CreateRoleRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        RoleDto dto = RoleDto.from(roleService.createRole(
                userId, tenantId, req.key(), req.name(), req.scopeType(), req.description()));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(dto));
    }

    @PatchMapping("/{roleId}")
    public ResponseEntity<ApiResponse<RoleDto>> update(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID roleId,
            @Valid @RequestBody UpdateRoleRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(
                RoleDto.from(roleService.updateRole(userId, tenantId, roleId,
                        req.name(), req.description()))));
    }

    @DeleteMapping("/{roleId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID roleId) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        roleService.deleteRole(userId, tenantId, roleId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── Role ↔ Permission ─────────────────────────────────────────────────────

    @GetMapping("/{roleId}/permissions")
    public ResponseEntity<ApiResponse<List<PermissionDto>>> listPermissions(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID roleId) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        List<PermissionDto> dtos = roleService.listRolePermissions(tenantId, roleId)
                .stream().map(PermissionDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @PostMapping("/{roleId}/permissions")
    public ResponseEntity<ApiResponse<Void>> assignPermission(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID roleId,
            @Valid @RequestBody AssignPermissionToRoleRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        roleService.assignPermission(userId, tenantId, roleId, req.permissionId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(null));
    }

    @DeleteMapping("/{roleId}/permissions/{permissionId}")
    public ResponseEntity<ApiResponse<Void>> revokePermission(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID roleId,
            @PathVariable UUID permissionId) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        roleService.revokePermission(userId, tenantId, roleId, permissionId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
