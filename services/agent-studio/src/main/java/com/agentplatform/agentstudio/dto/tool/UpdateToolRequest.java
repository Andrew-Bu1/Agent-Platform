package com.agentplatform.agentstudio.dto.tool;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class UpdateToolRequest {

    private String name;

    private String type;

    private String description;

    private Boolean requireApproval;

    private Map<String, Object> inputSchema;

    private Map<String, Object> outputSchema;

    private Map<String, Object> config;

    private Boolean isActive;
}
