package com.agentplatform.agentstudio.dto.workflow;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateWorkflowRequest {

    @NotBlank(message = "name is required")
    private String name;

    private String description;
}
