package com.agentplatform.studio.api.flow;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SaveFlowVersionRequest {

    private JsonNode graph;
    private JsonNode settings;
}
