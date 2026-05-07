package com.agentplatform.iam.api.tenant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record InviteMemberRequest(
        @NotBlank @Email String email,
        @NotBlank String roleKey
) {}
