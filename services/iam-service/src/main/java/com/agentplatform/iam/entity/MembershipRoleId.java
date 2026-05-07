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
public class MembershipRoleId implements Serializable {

    @Column(name = "membership_id", nullable = false)
    private UUID membershipId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;
}
