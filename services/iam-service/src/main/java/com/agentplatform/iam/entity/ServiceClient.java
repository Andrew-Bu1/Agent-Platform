package com.agentplatform.iam.entity;

import com.agentplatform.common.entity.BaseUuidEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "service_clients")
public class ServiceClient extends BaseUuidEntity {

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "client_id", nullable = false, unique = true, length = 150)
    private String clientId;

    @Column(name = "service_name", nullable = false, length = 255)
    private String serviceName;

    @Column(name = "secret_hash", nullable = false)
    private String secretHash;

    @Column(name = "secret_algorithm", nullable = false, length = 100)
    private String secretAlgorithm = "bcrypt";

    /** JSON array of audience strings, e.g. {@code ["datahub","aihub"]}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "allowed_audiences", nullable = false, columnDefinition = "jsonb")
    private String allowedAudiences = "[]";

    @Column(name = "access_token_ttl_seconds", nullable = false)
    private int accessTokenTtlSeconds = 3600;

    @Column(name = "description")
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
