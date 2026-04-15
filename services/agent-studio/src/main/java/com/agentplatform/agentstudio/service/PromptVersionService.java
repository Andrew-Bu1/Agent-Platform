package com.agentplatform.agentstudio.service;

import com.agentplatform.agentstudio.dto.prompt.CreatePromptVersionRequest;
import com.agentplatform.agentstudio.dto.prompt.PromptVersionResponse;
import com.agentplatform.agentstudio.entity.Agent;
import com.agentplatform.agentstudio.entity.PromptVersion;
import com.agentplatform.exception.AppException;
import com.agentplatform.agentstudio.repository.AgentRepository;
import com.agentplatform.agentstudio.repository.PromptVersionRepository;
import com.agentplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PromptVersionService {

    private final PromptVersionRepository promptVersionRepository;
    private final AgentRepository agentRepository;

    public List<PromptVersionResponse> listPromptVersions(UUID agentId) {
        Agent agent = findAgentOrThrow(agentId);
        return promptVersionRepository.findByAgentOrderByVersionDesc(agent)
                .stream().map(PromptVersionResponse::from).toList();
    }

    public PromptVersionResponse getPromptVersion(UUID agentId, UUID id) {
        PromptVersion pv = findOrThrow(id);
        if (!pv.getAgent().getId().equals(agentId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Prompt version not found for this agent");
        }
        return PromptVersionResponse.from(pv);
    }

    @Transactional
    public PromptVersionResponse createPromptVersion(UUID agentId, CreatePromptVersionRequest req) {
        Agent agent = findAgentOrThrow(agentId);
        UUID userId = SecurityUtils.currentUserId();
        int nextVersion = promptVersionRepository.findMaxVersionByAgent(agent) + 1;

        boolean activate = Boolean.TRUE.equals(req.getActivate());
        if (activate) {
            promptVersionRepository.deactivateAllForAgent(agent);
        }

        PromptVersion pv = PromptVersion.builder()
                .id(UUID.randomUUID())
                .agent(agent)
                .version(nextVersion)
                .systemPrompt(req.getSystemPrompt())
                .contextConfig(req.getContextConfig() != null ? req.getContextConfig() : new HashMap<>())
                .isActive(activate)
                .createdByUserId(userId)
                .build();

        return PromptVersionResponse.from(promptVersionRepository.save(pv));
    }

    @Transactional
    public PromptVersionResponse activatePromptVersion(UUID agentId, UUID id) {
        Agent agent = findAgentOrThrow(agentId);
        PromptVersion pv = findOrThrow(id);
        if (!pv.getAgent().getId().equals(agentId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Prompt version not found for this agent");
        }
        promptVersionRepository.deactivateAllForAgent(agent);
        pv.setIsActive(true);
        return PromptVersionResponse.from(promptVersionRepository.save(pv));
    }

    @Transactional
    public void deletePromptVersion(UUID agentId, UUID id) {
        PromptVersion pv = findOrThrow(id);
        if (!pv.getAgent().getId().equals(agentId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Prompt version not found for this agent");
        }
        promptVersionRepository.deleteById(id);
    }

    private Agent findAgentOrThrow(UUID agentId) {
        return agentRepository.findById(agentId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Agent not found"));
    }

    private PromptVersion findOrThrow(UUID id) {
        return promptVersionRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Prompt version not found"));
    }
}
