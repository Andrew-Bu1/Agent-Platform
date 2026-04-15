package com.agentplatform.access.dto;

import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
public class UpdateApiKeyRequest {

    private String name;

    private String scopes;

    private OffsetDateTime expiresAt;
}
