package com.agentplatform.access.service;

import com.agentplatform.access.dto.ApiKeyResponse;
import com.agentplatform.access.dto.CreateApiKeyRequest;
import com.agentplatform.access.dto.UpdateApiKeyRequest;
import com.agentplatform.access.dto.VerifyApiKeyRequest;
import com.agentplatform.access.entity.ApiKey;
import com.agentplatform.access.entity.Tenant;
import com.agentplatform.access.entity.User;
import com.agentplatform.access.repository.ApiKeyRepository;
import com.agentplatform.access.repository.TenantRepository;
import com.agentplatform.access.repository.UserRepository;
import com.agentplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public Page<ApiKeyResponse> listByTenant(UUID tenantId, String search, Pageable pageable) {
        Tenant tenant = findTenantOrThrow(tenantId);
        if (search == null || search.isBlank()) {
            return apiKeyRepository.findByTenant(tenant, pageable).map(ApiKeyResponse::from);
        }
        return apiKeyRepository.searchByTenant(tenant, search, pageable).map(ApiKeyResponse::from);
    }

    public ApiKeyResponse get(UUID id) {
        return ApiKeyResponse.from(findOrThrow(id));
    }

    /**
     * Creates a new API key. The raw secret is returned only in this response —
     * only the SHA-256 hash is persisted.
     */
    @Transactional
    public ApiKeyResponse create(UUID tenantId, CreateApiKeyRequest request) {
        Tenant tenant = findTenantOrThrow(tenantId);
        UUID actorId = SecurityUtils.currentUserId();
        User createdBy = userRepository.findById(actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requesting user not found"));

        String rawKey = generateRawKey();
        String keyHash = hashKey(rawKey);
        String prefix = buildPrefix(tenant.getCode());

        ApiKey apiKey = ApiKey.builder()
                .id(UUID.randomUUID())
                .tenant(tenant)
                .createdByUser(createdBy)
                .name(request.getName())
                .keyPrefix(prefix)
                .keyHash(keyHash)
                .scopes(request.getScopes() != null ? request.getScopes() : "[]")
                .status("active")
                .expiresAt(request.getExpiresAt())
                .build();

        ApiKey saved = apiKeyRepository.save(apiKey);
        auditLogService.log("user", actorId.toString(), tenantId,
                "api_key:create", "api_key", saved.getId().toString());

        return ApiKeyResponse.fromWithRawKey(saved, prefix + rawKey);
    }

    @Transactional
    public ApiKeyResponse update(UUID id, UpdateApiKeyRequest request) {
        ApiKey apiKey = findOrThrow(id);
        if (request.getName() != null) apiKey.setName(request.getName());
        if (request.getScopes() != null) apiKey.setScopes(request.getScopes());
        if (request.getExpiresAt() != null) apiKey.setExpiresAt(request.getExpiresAt());
        ApiKey saved = apiKeyRepository.save(apiKey);
        auditLogService.log("user", actorId(), saved.getTenant().getId(),
                "api_key:update", "api_key", id.toString());
        return ApiKeyResponse.from(saved);
    }

    @Transactional
    public void revoke(UUID id) {
        ApiKey apiKey = findOrThrow(id);
        if ("revoked".equals(apiKey.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "API key is already revoked");
        }
        apiKey.setStatus("revoked");
        apiKeyRepository.save(apiKey);
        auditLogService.log("user", actorId(), apiKey.getTenant().getId(),
                "api_key:revoke", "api_key", id.toString());
    }

    @Transactional
    public void delete(UUID id) {
        ApiKey apiKey = findOrThrow(id);
        UUID tenantId = apiKey.getTenant().getId();
        apiKeyRepository.deleteById(id);
        auditLogService.log("user", actorId(), tenantId,
                "api_key:delete", "api_key", id.toString());
    }

    /**
     * Validates a raw API key presented by an SDK or external caller.
     * Records last_used_at on success. Never reveals why validation failed.
     */
    @Transactional
    public ApiKeyResponse verify(VerifyApiKeyRequest request) {
        String raw = stripPrefix(request.getRawKey());
        String hash = hashKey(raw);
        ApiKey apiKey = apiKeyRepository.findByKeyHash(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API key"));

        if (!"active".equals(apiKey.getStatus())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API key");
        }
        if (apiKey.getExpiresAt() != null && apiKey.getExpiresAt().isBefore(java.time.OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API key");
        }

        apiKey.setLastUsedAt(java.time.OffsetDateTime.now());
        apiKeyRepository.save(apiKey);
        return ApiKeyResponse.from(apiKey);
    }

    // ---- private helpers ----

    private ApiKey findOrThrow(UUID id) {
        return apiKeyRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "API key not found"));
    }

    private Tenant findTenantOrThrow(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));
    }

    private String actorId() {
        try {
            return SecurityUtils.currentUserId().toString();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private String generateRawKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String buildPrefix(String tenantCode) {
        String safe = tenantCode.replaceAll("[^a-z0-9]", "");
        if (safe.length() > 8) safe = safe.substring(0, 8);
        return "ak_" + safe + "_";
    }

    /** Strip the display prefix (everything up to and including the last '_'). */
    private String stripPrefix(String key) {
        int idx = key.lastIndexOf('_');
        return idx >= 0 ? key.substring(idx + 1) : key;
    }

    private String hashKey(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
