package com.agentplatform.iam.api.role;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AssignPermissionToRoleRequest(@NotNull UUID permissionId) {}
