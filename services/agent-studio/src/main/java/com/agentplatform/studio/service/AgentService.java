package com.agentplatform.studio.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.entity.Agent;
import com.agentplatform.studio.repository.AgentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentService {

    private final AgentRepository agentRepo;

    @Transactional(readOnly = true)
    public Page<Agent> list(AuthContext auth, Pageable pageable) {
        return agentRepo.findByTenantIdAndWorkspaceIdAndStatusNot(
                uuid(auth.tenantId()), uuid(auth.workspaceId()), "archived", pageable);
    }

    @Transactional(readOnly = true)
    public Agent get(AuthContext auth, UUID id) {
        return agentRepo.findByIdAndTenantIdAndWorkspaceId(id, uuid(auth.tenantId()), uuid(auth.workspaceId()))
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND, "Agent not found: " + id));
    }

    @Transactional
    public Agent create(AuthContext auth, String name, String description, String agentKind,
                        String definitionJson, List<UUID> toolIds, String modelId) {
        if (agentRepo.existsByWorkspaceIdAndName(uuid(auth.workspaceId()), name)) {
            throw new ConflictException(ErrorCode.CONFLICT, "Agent name already exists in this workspace: " + name);
        }
        Agent agent = new Agent();
        agent.setTenantId(uuid(auth.tenantId()));
        agent.setWorkspaceId(uuid(auth.workspaceId()));
        agent.setName(name);
        agent.setDescription(description);
        agent.setAgentKind(agentKind != null ? agentKind : "single");
        agent.setDefinitionJson(definitionJson != null ? definitionJson : "{}");
        agent.setToolIds(toolIds != null ? toolIds : List.of());
        agent.setModelId(modelId);
        agent.setCreatedByUserId(uuid(auth.userId()));
        agent.setUpdatedByUserId(uuid(auth.userId()));
        return agentRepo.save(agent);
    }

    @Transactional
    public Agent update(AuthContext auth, UUID id, String name, String description, String agentKind,
                        String definitionJson, List<UUID> toolIds, String modelId, String status) {
        Agent agent = get(auth, id);
        if (name != null && !name.equals(agent.getName())) {
            if (agentRepo.existsByWorkspaceIdAndName(uuid(auth.workspaceId()), name)) {
                throw new ConflictException(ErrorCode.CONFLICT, "Agent name already exists in this workspace: " + name);
            }
            agent.setName(name);
        }
        if (description != null) agent.setDescription(description);
        if (agentKind != null) agent.setAgentKind(agentKind);
        if (definitionJson != null) agent.setDefinitionJson(definitionJson);
        if (toolIds != null) agent.setToolIds(toolIds);
        if (modelId != null) agent.setModelId(modelId);
        if (status != null) agent.setStatus(status);
        agent.setUpdatedByUserId(uuid(auth.userId()));
        return agentRepo.save(agent);
    }

    @Transactional
    public void archive(AuthContext auth, UUID id) {
        Agent agent = get(auth, id);
        agent.setStatus("archived");
        agent.setUpdatedByUserId(uuid(auth.userId()));
        agentRepo.save(agent);
    }

    private static UUID uuid(String s) {
        return s != null ? UUID.fromString(s) : null;
    }
}
