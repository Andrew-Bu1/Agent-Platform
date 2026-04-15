package com.agentplatform.agentstudio.service;

import com.agentplatform.agentstudio.dto.workflow.CreateWorkflowRequest;
import com.agentplatform.agentstudio.dto.workflow.UpdateWorkflowRequest;
import com.agentplatform.agentstudio.dto.workflow.WorkflowResponse;
import com.agentplatform.agentstudio.entity.Workflow;
import com.agentplatform.exception.AppException;
import com.agentplatform.agentstudio.repository.WorkflowRepository;
import com.agentplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowRepository workflowRepository;

    @Transactional(readOnly = true)
    public Page<WorkflowResponse> listWorkflows(String search, Pageable pageable) {
        UUID tenantId = SecurityUtils.currentTenantId();
        if (search == null || search.isBlank()) {
            return workflowRepository.findByTenantId(tenantId, pageable).map(WorkflowResponse::from);
        }
        return workflowRepository.searchByTenantId(tenantId, search, pageable).map(WorkflowResponse::from);
    }

    @Transactional(readOnly = true)
    public WorkflowResponse getWorkflow(UUID id) {
        return WorkflowResponse.from(findAndVerifyTenant(id));
    }

    @Transactional
    public WorkflowResponse createWorkflow(CreateWorkflowRequest req) {
        UUID tenantId = SecurityUtils.currentTenantId();
        UUID userId = SecurityUtils.currentUserId();
        Workflow workflow = Workflow.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .name(req.getName())
                .description(req.getDescription())
                .createdByUserId(userId)
                .updatedByUserId(userId)
                .build();
        return WorkflowResponse.from(workflowRepository.save(workflow));
    }

    @Transactional
    public WorkflowResponse updateWorkflow(UUID id, UpdateWorkflowRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        Workflow workflow = findAndVerifyTenant(id);
        if (req.getName() != null) workflow.setName(req.getName());
        if (req.getDescription() != null) workflow.setDescription(req.getDescription());
        if (req.getIsActive() != null) workflow.setIsActive(req.getIsActive());
        workflow.setUpdatedByUserId(userId);
        return WorkflowResponse.from(workflowRepository.save(workflow));
    }

    @Transactional
    public void deleteWorkflow(UUID id) {
        findAndVerifyTenant(id);
        workflowRepository.deleteById(id);
    }

    // Package-private: used by WorkflowVersionService to check tenant ownership
    Workflow findAndVerifyTenant(UUID id) {
        Workflow workflow = workflowRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Workflow not found"));
        if (!workflow.getTenantId().equals(SecurityUtils.currentTenantId())) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return workflow;
    }
}
