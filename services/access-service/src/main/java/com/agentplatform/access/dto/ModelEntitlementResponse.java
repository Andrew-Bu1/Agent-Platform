package com.agentplatform.access.dto;

import com.agentplatform.access.entity.ModelEntitlement;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ModelEntitlementResponse {

    private UUID id;
    private UUID tenantId;
    private String modelKey;
    private String operationType;
    private Boolean allowed;
    private Integer rpmLimit;
    private Integer tpmLimit;
    private Long dailyTokenLimit;
    private Long monthlyTokenLimit;
    private String config;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static ModelEntitlementResponse from(ModelEntitlement me) {
        return ModelEntitlementResponse.builder()
                .id(me.getId())
                .tenantId(me.getTenant().getId())
                .modelKey(me.getModelKey())
                .operationType(me.getOperationType())
                .allowed(me.getAllowed())
                .rpmLimit(me.getRpmLimit())
                .tpmLimit(me.getTpmLimit())
                .dailyTokenLimit(me.getDailyTokenLimit())
                .monthlyTokenLimit(me.getMonthlyTokenLimit())
                .config(me.getConfig())
                .createdAt(me.getCreatedAt())
                .updatedAt(me.getUpdatedAt())
                .build();
    }
}
