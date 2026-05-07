package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.OauthSigningKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface OauthSigningKeyRepository extends JpaRepository<OauthSigningKey, UUID> {

    Optional<OauthSigningKey> findFirstByStatusAndNotBeforeLessThanEqualOrderByCreatedAtDesc(
            String status, OffsetDateTime notBefore);

    boolean existsByStatus(String status);
}
