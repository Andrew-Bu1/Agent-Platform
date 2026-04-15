package com.agentplatform.agentstudio.dto.workflow;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GraphEdge {

    @NotBlank(message = "edge 'from' node id is required")
    private String from;

    @NotBlank(message = "edge 'to' node id is required")
    private String to;

    /**
     * Optional branch label — used by ROUTER nodes to identify which condition
     * activates this edge (e.g. "yes", "no", "escalate").
     */
    private String label;
}
