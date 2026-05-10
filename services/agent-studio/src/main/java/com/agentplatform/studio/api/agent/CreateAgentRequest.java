package com.agentplatform.studio.api.agent;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
public class CreateAgentRequest {

    @NotBlank
    private String name;

    private String   description;
    private String   agentKind = "single";
    private JsonNode definition;
    private List<UUID> toolIds;
    private String   modelId;
}
