package com.agentplatform.iam.api.auth;

import java.util.UUID;

public record TenantInfo(
        UUID id,
        String code,
        String name
) {}
