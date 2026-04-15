package com.agentplatform.access.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Getter
@NoArgsConstructor
public class AddMemberRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @Pattern(regexp = "active|invited", message = "Status must be 'active' or 'invited'")
    private String status = "active";
}
