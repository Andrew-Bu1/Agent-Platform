package com.agentplatform.iam.api.serviceclient;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AssignPermissionToClientRequest(@NotNull UUID permissionId) {}
