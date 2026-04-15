package com.agentplatform.access.controller;

import com.agentplatform.access.dto.ApiKeyResponse;
import com.agentplatform.access.dto.ApiResponse;
import com.agentplatform.access.dto.CreateApiKeyRequest;
import com.agentplatform.access.dto.UpdateApiKeyRequest;
import com.agentplatform.access.dto.VerifyApiKeyRequest;
import com.agentplatform.access.service.ApiKeyService;
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
@RequiredArgsConstructor
@Tag(name = "API Keys", description = "API key management for SDK access")
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    // ---- Tenant-scoped CRUD ----

    @GetMapping("/api/v1/tenants/{tenantId}/api-keys")
    @Operation(summary = "List API keys for a tenant")
    public ResponseEntity<Page<ApiKeyResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @Parameter(description = "Search by name", example = "nightly-sync")
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return ResponseEntity.ok(apiKeyService.listByTenant(tenantId, search, pageable));
    }

    @GetMapping("/api/v1/api-keys/{id}")
    @Operation(summary = "Get an API key by ID")
    public ResponseEntity<ApiKeyResponse> get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        return ResponseEntity.ok(apiKeyService.get(id));
    }

    @PostMapping("/api/v1/tenants/{tenantId}/api-keys")
    @Operation(
        summary = "Create an API key",
        description = "The raw key is returned **once** in `rawKey`. Store it securely — it cannot be retrieved again."
    )
    public ResponseEntity<ApiKeyResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId,
            @Valid @RequestBody CreateApiKeyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(apiKeyService.create(tenantId, request));
    }

    @PutMapping("/api/v1/api-keys/{id}")
    @Operation(summary = "Update an API key's name, scopes, or expiry")
    public ResponseEntity<ApiKeyResponse> update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateApiKeyRequest request) {
        return ResponseEntity.ok(apiKeyService.update(id, request));
    }

    @PostMapping("/api/v1/api-keys/{id}/revoke")
    @Operation(summary = "Revoke an API key (sets status to 'revoked')")
    public ResponseEntity<ApiResponse> revoke(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        apiKeyService.revoke(id);
        return ResponseEntity.ok(ApiResponse.ok("API key revoked"));
    }

    @DeleteMapping("/api/v1/api-keys/{id}")
    @Operation(summary = "Permanently delete an API key")
    public ResponseEntity<ApiResponse> delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        apiKeyService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("API key deleted"));
    }

    // ---- SDK verification endpoint (no JWT required — SDK uses raw key) ----

    @PostMapping("/api/v1/api-keys/verify")
    @Operation(
        summary = "Verify a raw API key",
        description = "Used by SDK/services to validate a raw API key. Returns key metadata including tenant and scopes."
    )
    public ResponseEntity<ApiKeyResponse> verify(
            @Valid @RequestBody VerifyApiKeyRequest request) {
        return ResponseEntity.ok(apiKeyService.verify(request));
    }
}
