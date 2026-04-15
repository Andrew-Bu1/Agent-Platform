package com.agentplatform.agentstudio.dto.workflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class CreateWorkflowVersionRequest {

    @NotNull(message = "graph is required")
    @Valid
    private WorkflowGraph graph;

    private Map<String, Object> settings;

    /** When true this version is immediately activated (deactivates any current active version). */
    private Boolean isActive;
}
