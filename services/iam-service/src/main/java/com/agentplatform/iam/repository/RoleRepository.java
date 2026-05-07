package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByKey(String key);
    List<Role> findByIdIn(List<UUID> ids);
}
