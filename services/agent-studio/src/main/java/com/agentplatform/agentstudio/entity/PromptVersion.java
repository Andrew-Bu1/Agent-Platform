package com.agentplatform.agentstudio.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "prompt_versions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PromptVersion {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agent_id", nullable = false)
    private Agent agent;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "system_prompt", columnDefinition = "TEXT", nullable = false)
    private String systemPrompt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_config", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> contextConfig = new HashMap<>();

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = false;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
