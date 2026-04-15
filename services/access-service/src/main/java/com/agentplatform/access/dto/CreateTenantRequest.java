package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class CreateTenantRequest {

    @NotBlank(message = "Tenant name is required")
    @Size(max = 255, message = "Name must not exceed 255 characters")
    private String name;

    @Pattern(regexp = "[a-z0-9-]*", message = "Code may only contain lowercase letters, digits and hyphens")
    @Size(max = 100, message = "Code must not exceed 100 characters")
    private String code;

    @Pattern(regexp = "basic|pro|enterprise", message = "Plan key must be 'basic', 'pro', or 'enterprise'")
    private String planKey;
}
