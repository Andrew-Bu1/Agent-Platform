package com.agentplatform.agentstudio.dto.tool;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class CreateToolRequest {

    @NotBlank(message = "name is required")
    private String name;

    @NotBlank(message = "type is required")
    private String type;

    private String description;

    private Boolean requireApproval;

    private Map<String, Object> inputSchema;

    private Map<String, Object> outputSchema;

    private Map<String, Object> config;
}
