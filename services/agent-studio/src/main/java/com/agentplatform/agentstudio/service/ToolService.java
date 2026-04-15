package com.agentplatform.agentstudio.service;

import com.agentplatform.agentstudio.dto.tool.CreateToolRequest;
import com.agentplatform.agentstudio.dto.tool.ToolResponse;
import com.agentplatform.agentstudio.dto.tool.UpdateToolRequest;
import com.agentplatform.agentstudio.entity.Tool;
import com.agentplatform.exception.AppException;
import com.agentplatform.agentstudio.repository.ToolRepository;
import com.agentplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ToolService {

    private final ToolRepository toolRepository;

    public Page<ToolResponse> listTools(String search, Pageable pageable) {
        UUID tenantId = SecurityUtils.currentTenantId();
        if (search == null || search.isBlank()) {
            return toolRepository.findByTenantId(tenantId, pageable).map(ToolResponse::from);
        }
        return toolRepository.searchByTenantId(tenantId, search, pageable).map(ToolResponse::from);
    }

    public ToolResponse getTool(UUID id) {
        return ToolResponse.from(findOrThrow(id));
    }

    @Transactional
    public ToolResponse createTool(CreateToolRequest req) {
        UUID tenantId = SecurityUtils.currentTenantId();
        UUID userId = SecurityUtils.currentUserId();
        Tool tool = Tool.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .name(req.getName())
                .type(req.getType())
                .description(req.getDescription())
                .requireApproval(req.getRequireApproval() != null ? req.getRequireApproval() : false)
                .inputSchema(req.getInputSchema() != null ? req.getInputSchema() : new HashMap<>())
                .outputSchema(req.getOutputSchema() != null ? req.getOutputSchema() : new HashMap<>())
                .config(req.getConfig() != null ? req.getConfig() : new HashMap<>())
                .createdByUserId(userId)
                .updatedByUserId(userId)
                .build();
        return ToolResponse.from(toolRepository.save(tool));
    }

    @Transactional
    public ToolResponse updateTool(UUID id, UpdateToolRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        Tool tool = findOrThrow(id);
        if (req.getName() != null) tool.setName(req.getName());
        if (req.getType() != null) tool.setType(req.getType());
        if (req.getDescription() != null) tool.setDescription(req.getDescription());
        if (req.getRequireApproval() != null) tool.setRequireApproval(req.getRequireApproval());
        if (req.getInputSchema() != null) tool.setInputSchema(req.getInputSchema());
        if (req.getOutputSchema() != null) tool.setOutputSchema(req.getOutputSchema());
        if (req.getConfig() != null) tool.setConfig(req.getConfig());
        if (req.getIsActive() != null) tool.setIsActive(req.getIsActive());
        tool.setUpdatedByUserId(userId);
        return ToolResponse.from(toolRepository.save(tool));
    }

    @Transactional
    public void deleteTool(UUID id) {
        if (!toolRepository.existsById(id)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Tool not found");
        }
        toolRepository.deleteById(id);
    }

    private Tool findOrThrow(UUID id) {
        return toolRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Tool not found"));
    }
}
