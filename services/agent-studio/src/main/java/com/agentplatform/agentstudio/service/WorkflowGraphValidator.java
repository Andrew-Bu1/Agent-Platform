package com.agentplatform.agentstudio.service;

import com.agentplatform.agentstudio.dto.workflow.GraphEdge;
import com.agentplatform.agentstudio.dto.workflow.NodeType;
import com.agentplatform.agentstudio.dto.workflow.WorkflowGraph;
import com.agentplatform.exception.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class WorkflowGraphValidator {

    public void validate(WorkflowGraph graph) {
        List<String> nodeIds = graph.getNodes().stream().map(n -> n.getId()).toList();

        // 1. No duplicate node IDs
        Set<String> seen = new HashSet<>();
        for (String id : nodeIds) {
            if (!seen.add(id)) {
                throw new AppException(HttpStatus.BAD_REQUEST, "Duplicate node id: " + id);
            }
        }

        Set<String> nodeIdSet = new HashSet<>(nodeIds);

        // 2. Exactly one INPUT node
        long inputCount = graph.getNodes().stream()
                .filter(n -> n.getType() == NodeType.INPUT).count();
        if (inputCount != 1) {
            throw new AppException(HttpStatus.BAD_REQUEST,
                    "Graph must have exactly one INPUT node, found: " + inputCount);
        }

        // 3. At least one OUTPUT node
        long outputCount = graph.getNodes().stream()
                .filter(n -> n.getType() == NodeType.OUTPUT).count();
        if (outputCount < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST,
                    "Graph must have at least one OUTPUT node");
        }

        // 4. All edge endpoints reference existing node IDs
        if (graph.getEdges() != null) {
            for (GraphEdge edge : graph.getEdges()) {
                if (!nodeIdSet.contains(edge.getFrom())) {
                    throw new AppException(HttpStatus.BAD_REQUEST,
                            "Edge references unknown node id in 'from': " + edge.getFrom());
                }
                if (!nodeIdSet.contains(edge.getTo())) {
                    throw new AppException(HttpStatus.BAD_REQUEST,
                            "Edge references unknown node id in 'to': " + edge.getTo());
                }
            }
        }
    }
}
