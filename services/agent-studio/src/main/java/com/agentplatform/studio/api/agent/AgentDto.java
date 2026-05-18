package com.agentplatform.studio.api.agent;

import com.agentplatform.studio.entity.Agent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
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
    private List<String> requiredPermissionKeys; // derived from agentKind, not stored
    private String status;
    private UUID   createdByUserId;
    private UUID   updatedByUserId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    private static final Map<String, List<String>> KIND_PERMISSIONS = Map.of(
            "llm",          List.of("model:invoke"),
            "tool_calling", List.of("model:invoke"),
            "react",        List.of("model:invoke", "agent:run"),
            "chain",        List.of("model:invoke", "flow:run"),
            "custom",       List.of()
    );

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
                .requiredPermissionKeys(KIND_PERMISSIONS.getOrDefault(a.getAgentKind(), List.of()))
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
