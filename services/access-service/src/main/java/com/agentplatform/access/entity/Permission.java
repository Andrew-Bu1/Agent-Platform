package com.agentplatform.access.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "permissions",
    uniqueConstraints = @UniqueConstraint(columnNames = {"resource", "action"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Permission {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String resource;

    @Column(nullable = false, length = 100)
    private String action;

    @Column
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
