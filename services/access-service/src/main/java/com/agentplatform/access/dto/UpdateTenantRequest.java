package com.agentplatform.access.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateTenantRequest {

    @Size(min = 1, max = 255, message = "Name must be between 1 and 255 characters")
    private String name;

    @Pattern(regexp = "active|disabled", message = "Status must be 'active' or 'disabled'")
    private String status;

    @Pattern(regexp = "basic|pro|enterprise", message = "Plan key must be 'basic', 'pro', or 'enterprise'")
    private String planKey;

    /** Raw JSON string stored as jsonb, e.g. {"allow_google_login": true} */
    private String settings;
}
