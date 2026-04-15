package com.agentplatform.access.dto;

import com.agentplatform.access.entity.Role;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RoleResponse {

    private UUID id;
    private String scopeType;
    private String name;
    private String description;
    private Boolean isSystem;
    private List<PermissionResponse> permissions;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static RoleResponse from(Role role) {
        return RoleResponse.builder()
                .id(role.getId())
                .scopeType(role.getScopeType())
                .name(role.getName())
                .description(role.getDescription())
                .isSystem(role.getIsSystem())
                .permissions(role.getPermissions() == null ? null :
                        role.getPermissions().stream().map(PermissionResponse::from).toList())
                .createdAt(role.getCreatedAt())
                .updatedAt(role.getUpdatedAt())
                .build();
    }
}
