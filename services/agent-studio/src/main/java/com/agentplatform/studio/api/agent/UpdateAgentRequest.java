package com.agentplatform.studio.api.agent;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
public class UpdateAgentRequest {

    private String   name;
    private String   description;
    private String   agentKind;
    private JsonNode definition;
    private List<UUID> toolIds;
    private String   modelId;
    private String   status;
}
