package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class CreateRoleRequest {

    @NotBlank
    private String name;

    private String scopeType;

    private String description;

    private Boolean isSystem;
}
