package com.agentplatform.agentstudio.dto.tool;

import com.agentplatform.agentstudio.entity.Tool;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Builder
public class ToolResponse {

    private UUID id;
    private UUID tenantId;
    private String name;
    private String type;
    private String description;
    private Boolean requireApproval;
    private Map<String, Object> inputSchema;
    private Map<String, Object> outputSchema;
    private Map<String, Object> config;
    private Boolean isActive;
    private UUID createdByUserId;
    private UUID updatedByUserId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static ToolResponse from(Tool tool) {
        return ToolResponse.builder()
                .id(tool.getId())
                .tenantId(tool.getTenantId())
                .name(tool.getName())
                .type(tool.getType())
                .description(tool.getDescription())
                .requireApproval(tool.getRequireApproval())
                .inputSchema(tool.getInputSchema())
                .outputSchema(tool.getOutputSchema())
                .config(tool.getConfig())
                .isActive(tool.getIsActive())
                .createdByUserId(tool.getCreatedByUserId())
                .updatedByUserId(tool.getUpdatedByUserId())
                .createdAt(tool.getCreatedAt())
                .updatedAt(tool.getUpdatedAt())
                .build();
    }
}
