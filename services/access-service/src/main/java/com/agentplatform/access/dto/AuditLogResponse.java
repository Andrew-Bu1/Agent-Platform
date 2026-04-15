package com.agentplatform.access.dto;

import com.agentplatform.access.entity.AuditLog;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuditLogResponse {

    private UUID id;
    private String actorType;
    private String actorId;
    private UUID tenantId;
    private String action;
    private String resourceType;
    private String resourceId;
    private String decision;
    private String reason;
    private String metadata;
    private OffsetDateTime createdAt;

    public static AuditLogResponse from(AuditLog log) {
        return AuditLogResponse.builder()
                .id(log.getId())
                .actorType(log.getActorType())
                .actorId(log.getActorId())
                .tenantId(log.getTenantId())
                .action(log.getAction())
                .resourceType(log.getResourceType())
                .resourceId(log.getResourceId())
                .decision(log.getDecision())
                .reason(log.getReason())
                .metadata(log.getMetadata())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
