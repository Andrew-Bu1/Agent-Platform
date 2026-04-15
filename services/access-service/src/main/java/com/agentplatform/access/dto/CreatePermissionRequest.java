package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class CreatePermissionRequest {

    @NotBlank
    private String resource;

    @NotBlank
    private String action;

    private String description;
}
