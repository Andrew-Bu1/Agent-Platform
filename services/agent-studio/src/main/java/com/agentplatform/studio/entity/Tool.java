package com.agentplatform.studio.entity;

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
@Table(name = "tools")
public class Tool extends BaseUuidEntity {

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "tool_type", nullable = false, length = 50)
    private String toolType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_schema", nullable = false, columnDefinition = "jsonb")
    private String inputSchema = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_schema", nullable = false, columnDefinition = "jsonb")
    private String outputSchema = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config_json", nullable = false, columnDefinition = "jsonb")
    private String configJson = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "approval_policy_json", nullable = false, columnDefinition = "jsonb")
    private String approvalPolicyJson = "{}";

    @Column(name = "status", nullable = false, length = 50)
    private String status = "active";

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;
}
