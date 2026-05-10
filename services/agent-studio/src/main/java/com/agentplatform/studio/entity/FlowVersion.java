package com.agentplatform.studio.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
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
@Table(name = "flow_versions")
public class FlowVersion {

    @Id
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "UUID")
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "flow_id", nullable = false)
    private UUID flowId;

    @Column(name = "version", nullable = false)
    private Integer version;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_json", nullable = false, columnDefinition = "jsonb")
    private String graphJson = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings_json", nullable = false, columnDefinition = "jsonb")
    private String settingsJson = "{}";

    @Column(name = "status", nullable = false, length = 50)
    private String status = "draft";

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void prePersist() {
        if (this.id == null) this.id = UUID.randomUUID();
        if (this.createdAt == null) this.createdAt = OffsetDateTime.now();
    }
}
