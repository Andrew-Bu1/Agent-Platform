package com.agentplatform.agentstudio.dto.agent;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class UpdateAgentRequest {

    private String name;

    private String description;

    private Map<String, Object> modelConfig;

    private Map<String, Object> memoryConfig;

    private Boolean isActive;
}
