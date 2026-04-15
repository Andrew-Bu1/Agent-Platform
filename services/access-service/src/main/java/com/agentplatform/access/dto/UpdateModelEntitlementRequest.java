package com.agentplatform.access.dto;

import lombok.Getter;

@Getter
public class UpdateModelEntitlementRequest {

    private Boolean allowed;

    private Integer rpmLimit;

    private Integer tpmLimit;

    private Long dailyTokenLimit;

    private Long monthlyTokenLimit;

    private String config;
}
