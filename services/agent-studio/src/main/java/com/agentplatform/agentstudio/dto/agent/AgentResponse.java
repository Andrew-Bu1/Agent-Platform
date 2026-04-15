package com.agentplatform.agentstudio.dto.agent;

import com.agentplatform.agentstudio.entity.Agent;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Builder
public class AgentResponse {

    private UUID id;
    private UUID tenantId;
    private String name;
    private String description;
    private Map<String, Object> modelConfig;
    private Map<String, Object> memoryConfig;
    private Boolean isActive;
    private UUID createdByUserId;
    private UUID updatedByUserId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static AgentResponse from(Agent agent) {
        return AgentResponse.builder()
                .id(agent.getId())
                .tenantId(agent.getTenantId())
                .name(agent.getName())
                .description(agent.getDescription())
                .modelConfig(agent.getModelConfig())
                .memoryConfig(agent.getMemoryConfig())
                .isActive(agent.getIsActive())
                .createdByUserId(agent.getCreatedByUserId())
                .updatedByUserId(agent.getUpdatedByUserId())
                .createdAt(agent.getCreatedAt())
                .updatedAt(agent.getUpdatedAt())
                .build();
    }
}
