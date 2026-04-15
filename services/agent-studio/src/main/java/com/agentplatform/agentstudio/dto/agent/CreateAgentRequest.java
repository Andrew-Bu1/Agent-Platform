package com.agentplatform.agentstudio.dto.agent;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class CreateAgentRequest {

    @NotBlank(message = "name is required")
    private String name;

    private String description;

    private Map<String, Object> modelConfig;

    private Map<String, Object> memoryConfig;
}
