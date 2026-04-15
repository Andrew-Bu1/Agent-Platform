package com.agentplatform.access.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateUserRequest {

    @Size(min = 1, max = 255, message = "Name must be between 1 and 255 characters")
    private String name;

    @Pattern(regexp = "active|disabled", message = "Status must be 'active' or 'disabled'")
    private String status;

    private String avatarUrl;
}
