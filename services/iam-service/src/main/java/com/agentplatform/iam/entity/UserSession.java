package com.agentplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "user_sessions")
public class UserSession {

    @Id
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "UUID")
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "workspace_id")
    private UUID workspaceId;

    /** SHA-256 hash of the refresh token (Base64-encoded). */
    @Column(name = "session_token_hash")
    private String sessionTokenHash;

    @Column(name = "auth_method", nullable = false, length = 50)
    private String authMethod = "password";

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "last_used_at")
    private OffsetDateTime lastUsedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
