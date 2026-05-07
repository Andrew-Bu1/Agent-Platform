package com.agentplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "oauth_signing_keys")
public class OauthSigningKey {

    @Id
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "UUID")
    private UUID id;

    @Column(name = "key_id", nullable = false, unique = true, length = 255)
    private String keyId;

    @Column(name = "algorithm", nullable = false, length = 50)
    private String algorithm = "RS256";

    /** Public JWK as JSON string (JSONB in DB). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "public_jwk", nullable = false, columnDefinition = "jsonb")
    private String publicJwk;

    /** AES-GCM encrypted private JWK string. */
    @Column(name = "encrypted_private_jwk", nullable = false)
    private String encryptedPrivateJwk;

    /**
     * Identifies which encryption key was used (null = use app secret, non-null = KMS key ID).
     */
    @Column(name = "encryption_key_id", length = 255)
    private String encryptionKeyId;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "active";

    @Column(name = "not_before", nullable = false)
    private OffsetDateTime notBefore = OffsetDateTime.now();

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
