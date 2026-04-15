package com.agentplatform.agentstudio.dto.workflow;

import jakarta.validation.Valid;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class UpdateWorkflowVersionRequest {

    @Valid
    private WorkflowGraph graph;

    private Map<String, Object> settings;

    /** Set to true to activate this version (deactivates the current active version). */
    private Boolean isActive;
}
