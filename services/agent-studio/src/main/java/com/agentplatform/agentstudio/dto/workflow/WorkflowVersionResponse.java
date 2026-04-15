package com.agentplatform.agentstudio.dto.workflow;

import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Builder
public class WorkflowVersionResponse {

    private UUID id;
    private UUID workflowId;
    private Integer version;
    /** The raw graph — same JSON shape as sent in the request. */
    private Map<String, Object> graph;
    private Map<String, Object> settings;
    private Boolean isActive;
    private UUID createdByUserId;
    private OffsetDateTime createdAt;
}
