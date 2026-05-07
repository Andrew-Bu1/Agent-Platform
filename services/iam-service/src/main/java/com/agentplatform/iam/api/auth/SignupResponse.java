package com.agentplatform.iam.api.auth;

import java.util.UUID;

public record SignupResponse(
        UUID userId,
        String email,
        String name
) {}
