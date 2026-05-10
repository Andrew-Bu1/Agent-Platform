package com.agentplatform.studio.entity;

import com.agentplatform.common.entity.BaseUuidEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "agents")
public class Agent extends BaseUuidEntity {

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "agent_kind", nullable = false, length = 50)
    private String agentKind = "single";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "definition_json", nullable = false, columnDefinition = "jsonb")
    private String definitionJson = "{}";

    @Column(name = "tool_ids", columnDefinition = "UUID[]")
    private List<UUID> toolIds = new ArrayList<>();

    @Column(name = "model_id", length = 255)
    private String modelId;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "draft";

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;
}
