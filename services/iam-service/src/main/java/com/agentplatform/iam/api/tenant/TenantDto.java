package com.agentplatform.iam.api.tenant;

import java.util.UUID;

public record TenantDto(UUID id, String code, String name, String status, String planKey) {}
