package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.ServiceClient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ServiceClientRepository extends JpaRepository<ServiceClient, UUID> {
    Optional<ServiceClient> findByClientIdAndIsActiveTrue(String clientId);
}
