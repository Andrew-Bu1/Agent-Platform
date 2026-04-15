package com.agentplatform.access.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Role {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "scope_type", nullable = false, length = 50)
    @Builder.Default
    private String scopeType = "tenant";

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column
    private String description;

    @Column(name = "is_system", nullable = false)
    @Builder.Default
    private Boolean isSystem = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "role_permissions",
        joinColumns = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    @Builder.Default
    private Set<Permission> permissions = new LinkedHashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
