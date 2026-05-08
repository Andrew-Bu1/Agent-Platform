package com.agentplatform.iam.api.permission;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.service.PermissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final PermissionService permissionService;

    /** Returns the caller's permissions directly from the JWT — no DB hit required. */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, List<String>>>> myPermissions(
            @AuthenticationPrincipal AuthContext ctx) {
        return ResponseEntity.ok(ApiResponse.ok(Map.of("permissions", ctx.permissions())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PermissionDto>>> list(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        List<PermissionDto> dtos = permissionService.listPermissions(tenantId)
                .stream().map(PermissionDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PermissionDto>> get(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(
                PermissionDto.from(permissionService.getPermission(id, tenantId))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PermissionDto>> create(
            @AuthenticationPrincipal AuthContext ctx,
            @Valid @RequestBody CreatePermissionRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        PermissionDto dto = PermissionDto.from(
                permissionService.createPermission(
                        userId, tenantId, req.key(), req.resource(), req.action(), req.description()));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(dto));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<PermissionDto>> update(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id,
            @RequestBody UpdatePermissionRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(
                PermissionDto.from(permissionService.updatePermission(userId, tenantId, id, req.description()))));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        permissionService.deletePermission(userId, tenantId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
