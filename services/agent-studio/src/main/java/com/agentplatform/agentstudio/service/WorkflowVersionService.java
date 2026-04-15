package com.agentplatform.agentstudio.service;

import com.agentplatform.agentstudio.dto.workflow.CreateWorkflowVersionRequest;
import com.agentplatform.agentstudio.dto.workflow.UpdateWorkflowVersionRequest;
import com.agentplatform.agentstudio.dto.workflow.WorkflowGraph;
import com.agentplatform.agentstudio.dto.workflow.WorkflowVersionResponse;
import com.agentplatform.agentstudio.entity.WorkflowVersion;
import com.agentplatform.exception.AppException;
import com.agentplatform.agentstudio.repository.WorkflowVersionRepository;
import com.agentplatform.security.SecurityUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkflowVersionService {

    private final WorkflowVersionRepository versionRepository;
    private final WorkflowService workflowService;
    private final WorkflowGraphValidator graphValidator;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<WorkflowVersionResponse> listVersions(UUID workflowId) {
        workflowService.findAndVerifyTenant(workflowId);
        return versionRepository.findByWorkflowIdOrderByVersionDesc(workflowId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public WorkflowVersionResponse getVersion(UUID workflowId, UUID versionId) {
        workflowService.findAndVerifyTenant(workflowId);
        WorkflowVersion v = findOrThrow(versionId);
        if (!v.getWorkflowId().equals(workflowId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Version not found for this workflow");
        }
        return toResponse(v);
    }

    @Transactional
    public WorkflowVersionResponse createVersion(UUID workflowId, CreateWorkflowVersionRequest req) {
        workflowService.findAndVerifyTenant(workflowId);
        graphValidator.validate(req.getGraph());

        boolean activate = Boolean.TRUE.equals(req.getIsActive());
        if (activate) {
            versionRepository.deactivateAllForWorkflow(workflowId);
        }

        int nextVersion = versionRepository.findMaxVersionByWorkflowId(workflowId) + 1;
        WorkflowVersion version = WorkflowVersion.builder()
                .id(UUID.randomUUID())
                .workflowId(workflowId)
                .version(nextVersion)
                .graph(toMap(req.getGraph()))
                .settings(req.getSettings() != null ? req.getSettings() : new HashMap<>())
                .isActive(activate)
                .createdByUserId(SecurityUtils.currentUserId())
                .build();

        return toResponse(versionRepository.save(version));
    }

    @Transactional
    public WorkflowVersionResponse updateVersion(UUID workflowId, UUID versionId,
                                                 UpdateWorkflowVersionRequest req) {
        workflowService.findAndVerifyTenant(workflowId);
        WorkflowVersion version = findOrThrow(versionId);
        if (!version.getWorkflowId().equals(workflowId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Version not found for this workflow");
        }

        if (req.getGraph() != null) {
            graphValidator.validate(req.getGraph());
            version.setGraph(toMap(req.getGraph()));
        }
        if (req.getSettings() != null) {
            version.setSettings(req.getSettings());
        }
        if (Boolean.TRUE.equals(req.getIsActive())) {
            versionRepository.deactivateAllForWorkflow(workflowId);
            version.setIsActive(true);
        }

        return toResponse(versionRepository.save(version));
    }

    @Transactional
    public void deleteVersion(UUID workflowId, UUID versionId) {
        workflowService.findAndVerifyTenant(workflowId);
        WorkflowVersion version = findOrThrow(versionId);
        if (!version.getWorkflowId().equals(workflowId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Version not found for this workflow");
        }
        versionRepository.deleteById(versionId);
    }

    private WorkflowVersion findOrThrow(UUID id) {
        return versionRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Workflow version not found"));
    }

    private Map<String, Object> toMap(WorkflowGraph graph) {
        return objectMapper.convertValue(graph, new TypeReference<Map<String, Object>>() {});
    }

    private WorkflowVersionResponse toResponse(WorkflowVersion v) {
        return WorkflowVersionResponse.builder()
                .id(v.getId())
                .workflowId(v.getWorkflowId())
                .version(v.getVersion())
                .graph(v.getGraph())
                .settings(v.getSettings())
                .isActive(v.getIsActive())
                .createdByUserId(v.getCreatedByUserId())
                .createdAt(v.getCreatedAt())
                .build();
    }
}
