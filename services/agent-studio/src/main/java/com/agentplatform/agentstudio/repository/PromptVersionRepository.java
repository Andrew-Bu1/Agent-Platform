package com.agentplatform.agentstudio.repository;

import com.agentplatform.agentstudio.entity.Agent;
import com.agentplatform.agentstudio.entity.PromptVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PromptVersionRepository extends JpaRepository<PromptVersion, UUID> {

    List<PromptVersion> findByAgentOrderByVersionDesc(Agent agent);

    Optional<PromptVersion> findByAgentAndIsActiveTrue(Agent agent);

    @Query("SELECT COALESCE(MAX(p.version), 0) FROM PromptVersion p WHERE p.agent = :agent")
    int findMaxVersionByAgent(@Param("agent") Agent agent);

    @Modifying
    @Query("UPDATE PromptVersion p SET p.isActive = false WHERE p.agent = :agent AND p.isActive = true")
    void deactivateAllForAgent(@Param("agent") Agent agent);
}
