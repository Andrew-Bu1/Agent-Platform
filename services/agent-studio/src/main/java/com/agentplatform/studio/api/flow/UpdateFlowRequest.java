package com.agentplatform.studio.api.flow;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateFlowRequest {

    private String name;
    private String description;
    private String status;
}
