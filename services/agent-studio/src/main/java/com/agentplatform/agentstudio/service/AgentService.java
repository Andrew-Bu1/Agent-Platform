package com.agentplatform.agentstudio.service;

import com.agentplatform.agentstudio.dto.agent.AgentResponse;
import com.agentplatform.agentstudio.dto.agent.CreateAgentRequest;
import com.agentplatform.agentstudio.dto.agent.UpdateAgentRequest;
import com.agentplatform.agentstudio.dto.tool.ToolResponse;
import com.agentplatform.agentstudio.entity.Agent;
import com.agentplatform.agentstudio.entity.Tool;
import com.agentplatform.exception.AppException;
import com.agentplatform.agentstudio.repository.AgentRepository;
import com.agentplatform.agentstudio.repository.ToolRepository;
import com.agentplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentService {

    private final AgentRepository agentRepository;
    private final ToolRepository toolRepository;

    public Page<AgentResponse> listAgents(String search, Pageable pageable) {
        UUID tenantId = SecurityUtils.currentTenantId();
        if (search == null || search.isBlank()) {
            return agentRepository.findByTenantId(tenantId, pageable).map(AgentResponse::from);
        }
        return agentRepository.searchByTenantId(tenantId, search, pageable).map(AgentResponse::from);
    }

    public AgentResponse getAgent(UUID id) {
        return AgentResponse.from(findOrThrow(id));
    }

    @Transactional
    public AgentResponse createAgent(CreateAgentRequest req) {
        UUID tenantId = SecurityUtils.currentTenantId();
        UUID userId = SecurityUtils.currentUserId();
        Agent agent = Agent.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .name(req.getName())
                .description(req.getDescription())
                .modelConfig(req.getModelConfig() != null ? req.getModelConfig() : new HashMap<>())
                .memoryConfig(req.getMemoryConfig() != null ? req.getMemoryConfig() : new HashMap<>())
                .createdByUserId(userId)
                .updatedByUserId(userId)
                .build();
        return AgentResponse.from(agentRepository.save(agent));
    }

    @Transactional
    public AgentResponse updateAgent(UUID id, UpdateAgentRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        Agent agent = findOrThrow(id);
        if (req.getName() != null) agent.setName(req.getName());
        if (req.getDescription() != null) agent.setDescription(req.getDescription());
        if (req.getModelConfig() != null) agent.setModelConfig(req.getModelConfig());
        if (req.getMemoryConfig() != null) agent.setMemoryConfig(req.getMemoryConfig());
        if (req.getIsActive() != null) agent.setIsActive(req.getIsActive());
        agent.setUpdatedByUserId(userId);
        return AgentResponse.from(agentRepository.save(agent));
    }

    @Transactional
    public void deleteAgent(UUID id) {
        if (!agentRepository.existsById(id)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Agent not found");
        }
        agentRepository.deleteById(id);
    }

    public List<ToolResponse> getAgentTools(UUID agentId) {
        Agent agent = findOrThrow(agentId);
        return agent.getTools().stream().map(ToolResponse::from).toList();
    }

    @Transactional
    public void addTool(UUID agentId, UUID toolId) {
        Agent agent = findOrThrow(agentId);
        Tool tool = toolRepository.findById(toolId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Tool not found"));
        agent.getTools().add(tool);
        agentRepository.save(agent);
    }

    @Transactional
    public void removeTool(UUID agentId, UUID toolId) {
        Agent agent = findOrThrow(agentId);
        boolean removed = agent.getTools().removeIf(t -> t.getId().equals(toolId));
        if (!removed) {
            throw new AppException(HttpStatus.NOT_FOUND, "Tool not assigned to this agent");
        }
        agentRepository.save(agent);
    }

    private Agent findOrThrow(UUID id) {
        return agentRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Agent not found"));
    }
}
