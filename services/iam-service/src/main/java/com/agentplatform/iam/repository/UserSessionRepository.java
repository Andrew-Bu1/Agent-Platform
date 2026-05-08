package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    List<UserSession> findByUserIdAndTenantIdAndRevokedAtIsNullAndExpiresAtAfter(
            UUID userId, UUID tenantId, OffsetDateTime now);

    List<UserSession> findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(
            UUID userId, OffsetDateTime now);

    Optional<UserSession> findBySessionTokenHashAndRevokedAtIsNullAndExpiresAtAfter(
            String sessionTokenHash, OffsetDateTime now);

    @Modifying
    @Query("UPDATE UserSession s SET s.revokedAt = :now WHERE s.userId = :userId AND s.revokedAt IS NULL")
    void revokeAllForUser(@Param("userId") UUID userId, @Param("now") OffsetDateTime now);

    @Modifying
    @Query("UPDATE UserSession s SET s.revokedAt = :now WHERE s.userId = :userId AND s.tenantId = :tenantId AND s.revokedAt IS NULL")
    void revokeAllForUserAndTenant(@Param("userId") UUID userId, @Param("tenantId") UUID tenantId,
                                   @Param("now") OffsetDateTime now);
}
