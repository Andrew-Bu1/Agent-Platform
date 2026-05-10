package com.agentplatform.studio.api.tool;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateToolRequest {

    @NotBlank
    private String name;

    private String   description;

    @NotBlank
    private String   toolType;

    private JsonNode inputSchema;
    private JsonNode outputSchema;
    private JsonNode config;
    private JsonNode approvalPolicy;
}
