package com.agentplatform.access.dto;

import com.agentplatform.access.entity.Tenant;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TenantResponse {

    private UUID id;
    private String code;
    private String name;
    private String status;
    private String planKey;
    private String settings;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static TenantResponse from(Tenant tenant) {
        return TenantResponse.builder()
                .id(tenant.getId())
                .code(tenant.getCode())
                .name(tenant.getName())
                .status(tenant.getStatus())
                .planKey(tenant.getPlanKey())
                .settings(tenant.getSettings())
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }
}
