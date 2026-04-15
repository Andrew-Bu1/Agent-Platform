package com.agentplatform.agentstudio.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "tools")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tool {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "require_approval", nullable = false)
    @Builder.Default
    private Boolean requireApproval = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_schema", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> inputSchema = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_schema", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> outputSchema = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> config = new HashMap<>();

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
