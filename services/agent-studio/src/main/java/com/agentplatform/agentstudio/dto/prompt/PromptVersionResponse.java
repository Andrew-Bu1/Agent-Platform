package com.agentplatform.agentstudio.dto.prompt;

import com.agentplatform.agentstudio.entity.PromptVersion;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Builder
public class PromptVersionResponse {

    private UUID id;
    private UUID agentId;
    private Integer version;
    private String systemPrompt;
    private Map<String, Object> contextConfig;
    private Boolean isActive;
    private UUID createdByUserId;
    private OffsetDateTime createdAt;

    public static PromptVersionResponse from(PromptVersion pv) {
        return PromptVersionResponse.builder()
                .id(pv.getId())
                .agentId(pv.getAgent().getId())
                .version(pv.getVersion())
                .systemPrompt(pv.getSystemPrompt())
                .contextConfig(pv.getContextConfig())
                .isActive(pv.getIsActive())
                .createdByUserId(pv.getCreatedByUserId())
                .createdAt(pv.getCreatedAt())
                .build();
    }
}
