package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class CreateModelEntitlementRequest {

    @NotBlank
    private String modelKey;

    @NotBlank
    private String operationType;

    private Boolean allowed;

    private Integer rpmLimit;

    private Integer tpmLimit;

    private Long dailyTokenLimit;

    private Long monthlyTokenLimit;

    private String config;
}
