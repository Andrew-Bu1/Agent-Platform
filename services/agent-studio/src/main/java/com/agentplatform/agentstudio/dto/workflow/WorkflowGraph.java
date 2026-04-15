package com.agentplatform.agentstudio.dto.workflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class WorkflowGraph {

    @NotEmpty(message = "graph must contain at least one node")
    @Valid
    private List<GraphNode> nodes;

    @Valid
    private List<GraphEdge> edges;
}
