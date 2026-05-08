package com.agentplatform.iam.api.serviceclient;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.api.permission.PermissionDto;
import com.agentplatform.iam.service.ServiceClientService;
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
@RequestMapping("/service-clients")
@RequiredArgsConstructor
public class ServiceClientController {

    private final ServiceClientService serviceClientService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ServiceClientDto>>> list(
            @AuthenticationPrincipal AuthContext ctx) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        List<ServiceClientDto> dtos = serviceClientService.listServiceClients(userId, tenantId)
                .stream().map(ServiceClientDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ServiceClientDto>> get(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(
                ServiceClientDto.from(serviceClientService.getServiceClient(userId, tenantId, id))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> create(
            @AuthenticationPrincipal AuthContext ctx,
            @Valid @RequestBody CreateServiceClientRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        ServiceClientService.ServiceClientCreated result = serviceClientService.createServiceClient(
                userId, tenantId, req.clientId(), req.serviceName(), req.description(),
                req.allowedAudiences(),
                req.accessTokenTtlSeconds() != null ? req.accessTokenTtlSeconds() : 3600);
        // Return the plain secret only once
        Map<String, Object> body = Map.of(
                "client", ServiceClientDto.from(result.client()),
                "clientSecret", result.plainSecret());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(body));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<ServiceClientDto>> update(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id,
            @RequestBody UpdateServiceClientRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(ServiceClientDto.from(
                serviceClientService.updateServiceClient(userId, tenantId, id,
                        req.serviceName(), req.description(),
                        req.allowedAudiences(), req.accessTokenTtlSeconds()))));
    }

    @PostMapping("/{id}/rotate-secret")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rotateSecret(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        ServiceClientService.ServiceClientCreated result =
                serviceClientService.rotateSecret(userId, tenantId, id);
        Map<String, Object> body = Map.of(
                "client", ServiceClientDto.from(result.client()),
                "clientSecret", result.plainSecret());
        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ApiResponse<ServiceClientDto>> deactivate(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(ServiceClientDto.from(
                serviceClientService.setActive(userId, tenantId, id, false))));
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<ServiceClientDto>> activate(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(ServiceClientDto.from(
                serviceClientService.setActive(userId, tenantId, id, true))));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        serviceClientService.deleteServiceClient(userId, tenantId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    @GetMapping("/{id}/permissions")
    public ResponseEntity<ApiResponse<List<PermissionDto>>> listPermissions(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        List<PermissionDto> dtos = serviceClientService.listPermissions(userId, tenantId, id)
                .stream().map(PermissionDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @PostMapping("/{id}/permissions")
    public ResponseEntity<ApiResponse<Void>> assignPermission(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id,
            @Valid @RequestBody AssignPermissionToClientRequest req) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        serviceClientService.assignPermission(userId, tenantId, id, req.permissionId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(null));
    }

    @DeleteMapping("/{id}/permissions/{permissionId}")
    public ResponseEntity<ApiResponse<Void>> revokePermission(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id,
            @PathVariable UUID permissionId) {
        UUID userId   = UUID.fromString(ctx.userId());
        UUID tenantId = UUID.fromString(ctx.tenantId());
        serviceClientService.revokePermission(userId, tenantId, id, permissionId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
