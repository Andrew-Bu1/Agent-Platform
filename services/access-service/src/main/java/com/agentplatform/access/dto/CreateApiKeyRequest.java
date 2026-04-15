package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
public class CreateApiKeyRequest {

    @NotBlank
    private String name;

    /** JSON array string, e.g. ["agent:run","datasource:create"] */
    private String scopes;

    private OffsetDateTime expiresAt;
}
