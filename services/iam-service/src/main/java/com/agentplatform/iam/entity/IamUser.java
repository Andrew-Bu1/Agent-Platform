package com.agentplatform.iam.entity;

import com.agentplatform.common.entity.BaseUuidEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Human platform users. Named {@code IamUser} to avoid collision with
 * {@code org.springframework.security.core.userdetails.User}.
 */
@Getter
@Setter
@Entity
@Table(name = "users")
public class IamUser extends BaseUuidEntity {

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "password_algorithm", length = 100)
    private String passwordAlgorithm = "bcrypt";

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "active";

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;
}
