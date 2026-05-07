package com.agentplatform.iam.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI / Swagger UI configuration for IAM Service.
 *
 * <p>UI available at: {@code http://localhost:8080/swagger-ui.html}
 * <br>JSON spec at:   {@code http://localhost:8080/v3/api-docs}
 *
 * <p>Public endpoints ({@code /auth/login}, {@code /oauth/token}, {@code /.well-known/jwks.json})
 * do not require the Bearer token.
 */
@OpenAPIDefinition(
        info = @Info(
                title       = "IAM Service API",
                version     = "1.0",
                description = "Identity & Access Management — user auth, OAuth2 client_credentials, JWKS, tenants, permissions.",
                contact     = @Contact(name = "Agent Platform", email = "platform@agentplatform.dev")
        ),
        servers = @Server(url = "/", description = "Current host"),
        security = @SecurityRequirement(name = "bearerAuth")
)
@SecurityScheme(
        name        = "bearerAuth",
        type        = SecuritySchemeType.HTTP,
        scheme      = "bearer",
        bearerFormat = "JWT",
        description = "Paste the access_token returned by POST /auth/login or POST /oauth/token"
)
@Configuration
public class SwaggerConfig {
    // SpringDoc auto-configures itself; this class exists solely to carry the annotations.
}
