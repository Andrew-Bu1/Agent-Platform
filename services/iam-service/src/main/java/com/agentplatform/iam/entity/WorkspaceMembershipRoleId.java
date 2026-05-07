package com.agentplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceMembershipRoleId implements Serializable {

    @Column(name = "workspace_membership_id", nullable = false)
    private UUID workspaceMembershipId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;
}
