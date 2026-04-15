package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class VerifyApiKeyRequest {

    @NotBlank
    private String rawKey;
}
