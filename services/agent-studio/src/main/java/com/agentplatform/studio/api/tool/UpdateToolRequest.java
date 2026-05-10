package com.agentplatform.studio.api.tool;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateToolRequest {

    private String   name;
    private String   description;
    private JsonNode inputSchema;
    private JsonNode outputSchema;
    private JsonNode config;
    private JsonNode approvalPolicy;
    private String   status;
}
