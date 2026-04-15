package com.agentplatform.access.dto;

import com.agentplatform.access.entity.ApiKey;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiKeyResponse {

    private UUID id;
    private UUID tenantId;
    private UUID createdByUserId;
    private String name;
    private String keyPrefix;
    private String scopes;
    private String status;
    private OffsetDateTime expiresAt;
    private OffsetDateTime lastUsedAt;
    private OffsetDateTime createdAt;

    /** The raw secret — only populated once, at creation time. */
    private String rawKey;

    public static ApiKeyResponse from(ApiKey apiKey) {
        return ApiKeyResponse.builder()
                .id(apiKey.getId())
                .tenantId(apiKey.getTenant().getId())
                .createdByUserId(apiKey.getCreatedByUser().getId())
                .name(apiKey.getName())
                .keyPrefix(apiKey.getKeyPrefix())
                .scopes(apiKey.getScopes())
                .status(apiKey.getStatus())
                .expiresAt(apiKey.getExpiresAt())
                .lastUsedAt(apiKey.getLastUsedAt())
                .createdAt(apiKey.getCreatedAt())
                .build();
    }

    public static ApiKeyResponse fromWithRawKey(ApiKey apiKey, String rawKey) {
        return ApiKeyResponse.builder()
                .id(apiKey.getId())
                .tenantId(apiKey.getTenant().getId())
                .createdByUserId(apiKey.getCreatedByUser().getId())
                .name(apiKey.getName())
                .keyPrefix(apiKey.getKeyPrefix())
                .scopes(apiKey.getScopes())
                .status(apiKey.getStatus())
                .expiresAt(apiKey.getExpiresAt())
                .lastUsedAt(apiKey.getLastUsedAt())
                .createdAt(apiKey.getCreatedAt())
                .rawKey(rawKey)
                .build();
    }
}
