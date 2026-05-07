package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.IamUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<IamUser, UUID> {
    Optional<IamUser> findByEmail(String email);
    boolean existsByEmail(String email);
}
