package com.agentplatform.studio.api.flow;

import com.agentplatform.studio.entity.Flow;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class FlowDto {

    private UUID   id;
    private UUID   tenantId;
    private UUID   workspaceId;
    private String name;
    private String description;
    private String status;
    private UUID   currentVersionId;
    private UUID   createdByUserId;
    private UUID   updatedByUserId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static FlowDto from(Flow f) {
        return FlowDto.builder()
                .id(f.getId())
                .tenantId(f.getTenantId())
                .workspaceId(f.getWorkspaceId())
                .name(f.getName())
                .description(f.getDescription())
                .status(f.getStatus())
                .currentVersionId(f.getCurrentVersionId())
                .createdByUserId(f.getCreatedByUserId())
                .updatedByUserId(f.getUpdatedByUserId())
                .createdAt(f.getCreatedAt())
                .updatedAt(f.getUpdatedAt())
                .build();
    }
}
