package com.agentplatform.agentstudio.dto.workflow;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateWorkflowRequest {

    private String name;
    private String description;
    private Boolean isActive;
}
