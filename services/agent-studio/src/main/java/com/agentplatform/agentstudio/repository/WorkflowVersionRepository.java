package com.agentplatform.agentstudio.repository;

import com.agentplatform.agentstudio.entity.WorkflowVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowVersionRepository extends JpaRepository<WorkflowVersion, UUID> {

    List<WorkflowVersion> findByWorkflowIdOrderByVersionDesc(UUID workflowId);

    Optional<WorkflowVersion> findByWorkflowIdAndIsActiveTrue(UUID workflowId);

    @Query("SELECT COALESCE(MAX(v.version), 0) FROM WorkflowVersion v WHERE v.workflowId = :workflowId")
    int findMaxVersionByWorkflowId(@Param("workflowId") UUID workflowId);

    @Modifying
    @Query("UPDATE WorkflowVersion v SET v.isActive = false WHERE v.workflowId = :workflowId AND v.isActive = true")
    void deactivateAllForWorkflow(@Param("workflowId") UUID workflowId);
}
