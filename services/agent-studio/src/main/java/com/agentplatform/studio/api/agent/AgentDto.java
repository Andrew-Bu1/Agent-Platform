package com.agentplatform.studio.api.agent;

import com.agentplatform.studio.entity.Agent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Builder
public class AgentDto {

    private UUID   id;
    private UUID   tenantId;
    private UUID   workspaceId;
    private String name;
    private String description;
    private String agentKind;
    private Object definition;
    private List<UUID> toolIds;
    private String modelId;
    private String status;
    private UUID   createdByUserId;
    private UUID   updatedByUserId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static AgentDto from(Agent a, ObjectMapper mapper) {
        return AgentDto.builder()
                .id(a.getId())
                .tenantId(a.getTenantId())
                .workspaceId(a.getWorkspaceId())
                .name(a.getName())
                .description(a.getDescription())
                .agentKind(a.getAgentKind())
                .definition(parseJson(a.getDefinitionJson(), mapper))
                .toolIds(a.getToolIds())
                .modelId(a.getModelId())
                .status(a.getStatus())
                .createdByUserId(a.getCreatedByUserId())
                .updatedByUserId(a.getUpdatedByUserId())
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .build();
    }

    private static Object parseJson(String json, ObjectMapper mapper) {
        try {
            return json != null ? mapper.readValue(json, new TypeReference<Object>() {}) : null;
        } catch (Exception e) {
            return json;
        }
    }
}
