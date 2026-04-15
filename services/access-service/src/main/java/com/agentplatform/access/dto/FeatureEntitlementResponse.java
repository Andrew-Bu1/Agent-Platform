package com.agentplatform.access.dto;

import com.agentplatform.access.entity.FeatureEntitlement;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FeatureEntitlementResponse {

    private UUID id;
    private UUID tenantId;
    private String featureKey;
    private Boolean enabled;
    private String config;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static FeatureEntitlementResponse from(FeatureEntitlement fe) {
        return FeatureEntitlementResponse.builder()
                .id(fe.getId())
                .tenantId(fe.getTenant().getId())
                .featureKey(fe.getFeatureKey())
                .enabled(fe.getEnabled())
                .config(fe.getConfig())
                .createdAt(fe.getCreatedAt())
                .updatedAt(fe.getUpdatedAt())
                .build();
    }
}
