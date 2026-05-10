package com.agentplatform.studio.repository;

import com.agentplatform.studio.entity.FlowVersion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface FlowVersionRepository extends JpaRepository<FlowVersion, UUID> {

    Page<FlowVersion> findByFlowId(UUID flowId, Pageable pageable);

    Optional<FlowVersion> findByIdAndFlowId(UUID id, UUID flowId);

    @Query("SELECT COALESCE(MAX(fv.version), 0) FROM FlowVersion fv WHERE fv.flowId = :flowId")
    int findMaxVersionByFlowId(UUID flowId);
}
