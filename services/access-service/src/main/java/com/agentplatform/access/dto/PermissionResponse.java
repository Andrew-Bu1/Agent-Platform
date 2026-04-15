package com.agentplatform.access.dto;

import com.agentplatform.access.entity.Permission;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PermissionResponse {

    private UUID id;
    private String resource;
    private String action;
    private String description;
    private OffsetDateTime createdAt;

    public static PermissionResponse from(Permission permission) {
        return PermissionResponse.builder()
                .id(permission.getId())
                .resource(permission.getResource())
                .action(permission.getAction())
                .description(permission.getDescription())
                .createdAt(permission.getCreatedAt())
                .build();
    }
}
