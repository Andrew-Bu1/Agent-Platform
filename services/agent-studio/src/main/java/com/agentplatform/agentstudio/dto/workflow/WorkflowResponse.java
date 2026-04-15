package com.agentplatform.agentstudio.dto.workflow;

import com.agentplatform.agentstudio.entity.Workflow;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class WorkflowResponse {

    private UUID id;
    private UUID tenantId;
    private String name;
    private String description;
    private Boolean isActive;
    private UUID createdByUserId;
    private UUID updatedByUserId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static WorkflowResponse from(Workflow w) {
        return WorkflowResponse.builder()
                .id(w.getId())
                .tenantId(w.getTenantId())
                .name(w.getName())
                .description(w.getDescription())
                .isActive(w.getIsActive())
                .createdByUserId(w.getCreatedByUserId())
                .updatedByUserId(w.getUpdatedByUserId())
                .createdAt(w.getCreatedAt())
                .updatedAt(w.getUpdatedAt())
                .build();
    }
}
