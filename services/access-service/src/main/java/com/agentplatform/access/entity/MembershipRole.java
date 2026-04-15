package com.agentplatform.access.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "membership_roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MembershipRole {

    @EmbeddedId
    private MembershipRoleId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("membershipId")
    @JoinColumn(name = "membership_id", nullable = false)
    private Membership membership;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("roleId")
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class MembershipRoleId implements Serializable {

        @Column(name = "membership_id")
        private UUID membershipId;

        @Column(name = "role_id")
        private UUID roleId;
    }
}
