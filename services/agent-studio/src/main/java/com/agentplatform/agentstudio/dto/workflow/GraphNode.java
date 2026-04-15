package com.agentplatform.agentstudio.dto.workflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;
import java.util.UUID;

@Getter
@Setter
public class GraphNode {

    /** Unique id within the graph — used by edges. E.g. "node-1", "router-a". */
    @NotBlank(message = "node id is required")
    private String id;

    @NotNull(message = "node type is required")
    private NodeType type;

    /** Human-readable display name shown in the canvas UI. */
    private String name;

    /**
     * Agent assigned to this node. Optional at design time — the UI may place nodes
     * before agents are assigned.
     * Relevant for: AGENT, ROUTER, AGGREGATOR, TEAM.
     */
    private UUID agentId;

    /**
     * Node-level configuration. Shape depends on node type:
     * <ul>
     *   <li>ROUTER: {"conditions": [{"branch": "yes", "expression": "..."}]}</li>
     *   <li>PARALLEL: {"wait_for_all": true}</li>
     *   <li>AGGREGATOR: {"strategy": "concat|vote|custom"}</li>
     *   <li>TEAM: {"max_rounds": 5}</li>
     * </ul>
     */
    private Map<String, Object> config;
}
