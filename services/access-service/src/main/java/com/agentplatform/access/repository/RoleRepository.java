package com.agentplatform.access.repository;

import com.agentplatform.access.entity.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByName(String name);

    boolean existsByName(String name);

    @Query("SELECT r FROM Role r WHERE r.scopeType = :scopeType")
    Page<Role> findByScopeType(@Param("scopeType") String scopeType, Pageable pageable);

    @Query("SELECT r FROM Role r WHERE " +
           "LOWER(r.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(r.description) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Role> search(@Param("search") String search, Pageable pageable);
}
