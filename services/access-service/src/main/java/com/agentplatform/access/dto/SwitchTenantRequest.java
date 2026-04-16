package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Getter
@NoArgsConstructor
public class SwitchTenantRequest {

    @NotNull(message = "tenantId is required")
    private UUID tenantId;
}
