package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

@Getter
public class AssignPermissionsRequest {

    @NotEmpty
    private List<UUID> permissionIds;
}
