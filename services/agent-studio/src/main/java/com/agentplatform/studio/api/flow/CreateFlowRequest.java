package com.agentplatform.studio.api.flow;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateFlowRequest {

    @NotBlank
    private String name;

    private String description;
}
