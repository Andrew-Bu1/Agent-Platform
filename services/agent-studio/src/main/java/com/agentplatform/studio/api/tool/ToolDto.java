package com.agentplatform.studio.api.tool;

import com.agentplatform.studio.entity.Tool;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class ToolDto {

    private UUID   id;
    private UUID   tenantId;
    private UUID   workspaceId;
    private String name;
    private String description;
    private String toolType;
    private Object inputSchema;
    private Object outputSchema;
    private Object config;
    private Object approvalPolicy;
    private String status;
    private UUID   createdByUserId;
    private UUID   updatedByUserId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static ToolDto from(Tool t, ObjectMapper mapper) {
        return ToolDto.builder()
                .id(t.getId())
                .tenantId(t.getTenantId())
                .workspaceId(t.getWorkspaceId())
                .name(t.getName())
                .description(t.getDescription())
                .toolType(t.getToolType())
                .inputSchema(parse(t.getInputSchema(), mapper))
                .outputSchema(parse(t.getOutputSchema(), mapper))
                .config(parse(t.getConfigJson(), mapper))
                .approvalPolicy(parse(t.getApprovalPolicyJson(), mapper))
                .status(t.getStatus())
                .createdByUserId(t.getCreatedByUserId())
                .updatedByUserId(t.getUpdatedByUserId())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private static Object parse(String json, ObjectMapper mapper) {
        try {
            return json != null ? mapper.readValue(json, new TypeReference<Object>() {}) : null;
        } catch (Exception e) {
            return json;
        }
    }
}
