package com.agentplatform.access.controller;

import com.agentplatform.access.dto.AddMemberRequest;
import com.agentplatform.dto.ApiResponse;
import com.agentplatform.access.dto.CreateTenantRequest;
import com.agentplatform.access.dto.MembershipResponse;
import com.agentplatform.access.dto.TenantResponse;
import com.agentplatform.access.dto.UpdateTenantRequest;
import com.agentplatform.access.service.TenantService;
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
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@Tag(name = "Tenants", description = "Tenant management")
public class TenantController {

    private final TenantService tenantService;

    @GetMapping
    @Operation(summary = "List tenants", description = "Paginated list with optional search by name or code")
    public ResponseEntity<ApiResponse<Page<TenantResponse>>> listTenants(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Filter by name or code", example = "finance")
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.ok(tenantService.listTenants(search, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get tenant by ID")
    public ResponseEntity<ApiResponse<TenantResponse>> getTenant(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(tenantService.getTenant(id)));
    }

    @PostMapping
    @Operation(summary = "Create tenant")
    public ResponseEntity<ApiResponse<TenantResponse>> createTenant(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateTenantRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(tenantService.createTenant(req)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update tenant")
    public ResponseEntity<ApiResponse<TenantResponse>> updateTenant(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTenantRequest req
    ) {
        return ResponseEntity.ok(ApiResponse.ok(tenantService.updateTenant(id, req)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete tenant")
    public ResponseEntity<ApiResponse<Void>> deleteTenant(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        tenantService.deleteTenant(id);
        return ResponseEntity.ok(ApiResponse.ok("Tenant deleted successfully"));
    }

    @GetMapping("/{id}/members")
    @Operation(summary = "List tenant members")
    public ResponseEntity<ApiResponse<List<MembershipResponse>>> getMembers(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(tenantService.getTenantMembers(id)));
    }

    @PostMapping("/{id}/members")
    @Operation(summary = "Add member to tenant")
    public ResponseEntity<ApiResponse<MembershipResponse>> addMember(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody AddMemberRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(tenantService.addMember(id, req)));
    }

    @DeleteMapping("/{id}/members/{userId}")
    @Operation(summary = "Remove member from tenant")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID userId
    ) {
        tenantService.removeMember(id, userId);
        return ResponseEntity.ok(ApiResponse.ok("Member removed successfully"));
    }
}
