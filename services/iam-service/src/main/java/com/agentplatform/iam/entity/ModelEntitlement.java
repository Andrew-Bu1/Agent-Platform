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
@Table(name = "model_entitlement")
public class ModelEntitlement extends BaseUuidEntity {

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "model_key", nullable = false, length = 150)
    private String modelKey;

    @Column(name = "operation_type", nullable = false, length = 50)
    private String operationType;

    @Column(name = "allowed", nullable = false)
    private boolean allowed = true;

    @Column(name = "rpm_limit")
    private Integer rpmLimit;

    @Column(name = "tpm_limit")
    private Integer tpmLimit;

    @Column(name = "daily_token_limit")
    private Long dailyTokenLimit;

    @Column(name = "monthly_token_limit")
    private Long monthlyTokenLimit;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", nullable = false, columnDefinition = "jsonb")
    private String config = "{}";
}
