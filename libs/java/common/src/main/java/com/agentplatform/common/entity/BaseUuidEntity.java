package com.agentplatform.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Base JPA entity: UUID primary key + audit timestamps.
 *
 * <p>Timestamps are set defensively in {@code @PrePersist} / {@code @PreUpdate} so they
 * are always populated even when JPA auditing ({@code @EnableJpaAuditing}) is not
 * configured on a service.
 *
 * <p>Services that want JPA auditing must annotate their {@code @SpringBootApplication}
 * (or a {@code @Configuration}) with {@code @EnableJpaAuditing}.
 */
@Getter
@Setter
@MappedSuperclass
public abstract class BaseUuidEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "UUID")
    private UUID id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
