package com.agentplatform.studio.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.entity.Tool;
import com.agentplatform.studio.repository.ToolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ToolService {

    private final ToolRepository toolRepo;

    @Transactional(readOnly = true)
    public Page<Tool> list(AuthContext auth, Pageable pageable) {
        return toolRepo.findByTenantIdAndWorkspaceIdAndStatusNot(
                uuid(auth.tenantId()), uuid(auth.workspaceId()), "archived", pageable);
    }

    @Transactional(readOnly = true)
    public Tool get(AuthContext auth, UUID id) {
        return toolRepo.findByIdAndTenantIdAndWorkspaceId(id, uuid(auth.tenantId()), uuid(auth.workspaceId()))
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND, "Tool not found: " + id));
    }

    @Transactional
    public Tool create(AuthContext auth, String name, String description, String toolType,
                       String inputSchema, String outputSchema, String configJson, String approvalPolicyJson) {
        if (toolRepo.existsByWorkspaceIdAndName(uuid(auth.workspaceId()), name)) {
            throw new ConflictException(ErrorCode.CONFLICT, "Tool name already exists in this workspace: " + name);
        }
        Tool tool = new Tool();
        tool.setTenantId(uuid(auth.tenantId()));
        tool.setWorkspaceId(uuid(auth.workspaceId()));
        tool.setName(name);
        tool.setDescription(description);
        tool.setToolType(toolType);
        tool.setInputSchema(inputSchema != null ? inputSchema : "{}");
        tool.setOutputSchema(outputSchema != null ? outputSchema : "{}");
        tool.setConfigJson(configJson != null ? configJson : "{}");
        tool.setApprovalPolicyJson(approvalPolicyJson != null ? approvalPolicyJson : "{}");
        tool.setCreatedByUserId(uuid(auth.userId()));
        tool.setUpdatedByUserId(uuid(auth.userId()));
        return toolRepo.save(tool);
    }

    @Transactional
    public Tool update(AuthContext auth, UUID id, String name, String description,
                       String inputSchema, String outputSchema, String configJson,
                       String approvalPolicyJson, String status) {
        Tool tool = get(auth, id);
        if (name != null && !name.equals(tool.getName())) {
            if (toolRepo.existsByWorkspaceIdAndName(uuid(auth.workspaceId()), name)) {
                throw new ConflictException(ErrorCode.CONFLICT, "Tool name already exists in this workspace: " + name);
            }
            tool.setName(name);
        }
        if (description != null) tool.setDescription(description);
        if (inputSchema != null) tool.setInputSchema(inputSchema);
        if (outputSchema != null) tool.setOutputSchema(outputSchema);
        if (configJson != null) tool.setConfigJson(configJson);
        if (approvalPolicyJson != null) tool.setApprovalPolicyJson(approvalPolicyJson);
        if (status != null) tool.setStatus(status);
        tool.setUpdatedByUserId(uuid(auth.userId()));
        return toolRepo.save(tool);
    }

    @Transactional
    public void archive(AuthContext auth, UUID id) {
        Tool tool = get(auth, id);
        tool.setStatus("archived");
        tool.setUpdatedByUserId(uuid(auth.userId()));
        toolRepo.save(tool);
    }

    private static UUID uuid(String s) {
        return s != null ? UUID.fromString(s) : null;
    }
}
