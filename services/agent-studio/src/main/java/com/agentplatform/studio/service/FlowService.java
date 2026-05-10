package com.agentplatform.studio.service;

import com.agentplatform.common.exception.AppException;
import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.entity.Flow;
import com.agentplatform.studio.entity.FlowVersion;
import com.agentplatform.studio.repository.FlowRepository;
import com.agentplatform.studio.repository.FlowVersionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FlowService {

    private final FlowRepository        flowRepo;
    private final FlowVersionRepository versionRepo;
    private final ObjectMapper          objectMapper;

    @Transactional(readOnly = true)
    public Page<Flow> list(AuthContext auth, Pageable pageable) {
        return flowRepo.findByTenantIdAndWorkspaceIdAndStatusNot(
                uuid(auth.tenantId()), uuid(auth.workspaceId()), "archived", pageable);
    }

    @Transactional(readOnly = true)
    public Flow get(AuthContext auth, UUID id) {
        return flowRepo.findByIdAndTenantIdAndWorkspaceId(id, uuid(auth.tenantId()), uuid(auth.workspaceId()))
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND, "Flow not found: " + id));
    }

    @Transactional
    public Flow create(AuthContext auth, String name, String description) {
        if (flowRepo.existsByWorkspaceIdAndName(uuid(auth.workspaceId()), name)) {
            throw new ConflictException(ErrorCode.CONFLICT, "Flow name already exists in this workspace: " + name);
        }
        Flow flow = new Flow();
        flow.setTenantId(uuid(auth.tenantId()));
        flow.setWorkspaceId(uuid(auth.workspaceId()));
        flow.setName(name);
        flow.setDescription(description);
        flow.setCreatedByUserId(uuid(auth.userId()));
        flow.setUpdatedByUserId(uuid(auth.userId()));
        return flowRepo.save(flow);
    }

    @Transactional
    public Flow update(AuthContext auth, UUID id, String name, String description, String status) {
        Flow flow = get(auth, id);
        if (name != null && !name.equals(flow.getName())) {
            if (flowRepo.existsByWorkspaceIdAndName(uuid(auth.workspaceId()), name)) {
                throw new ConflictException(ErrorCode.CONFLICT, "Flow name already exists in this workspace: " + name);
            }
            flow.setName(name);
        }
        if (description != null) flow.setDescription(description);
        if (status != null) flow.setStatus(status);
        flow.setUpdatedByUserId(uuid(auth.userId()));
        return flowRepo.save(flow);
    }

    @Transactional
    public void archive(AuthContext auth, UUID id) {
        Flow flow = get(auth, id);
        flow.setStatus("archived");
        flow.setUpdatedByUserId(uuid(auth.userId()));
        flowRepo.save(flow);
    }

    // ── Flow Versions ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<FlowVersion> listVersions(AuthContext auth, UUID flowId, Pageable pageable) {
        get(auth, flowId); // verify access
        return versionRepo.findByFlowId(flowId, pageable);
    }

    @Transactional(readOnly = true)
    public FlowVersion getVersion(AuthContext auth, UUID flowId, UUID versionId) {
        get(auth, flowId); // verify access
        return versionRepo.findByIdAndFlowId(versionId, flowId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND, "Flow version not found: " + versionId));
    }

    @Transactional
    public FlowVersion createVersion(AuthContext auth, UUID flowId, String graphJson, String settingsJson) {
        Flow flow = get(auth, flowId);
        int nextVersion = versionRepo.findMaxVersionByFlowId(flowId) + 1;

        FlowVersion version = new FlowVersion();
        version.setTenantId(uuid(auth.tenantId()));
        version.setWorkspaceId(uuid(auth.workspaceId()));
        version.setFlowId(flowId);
        version.setVersion(nextVersion);
        version.setGraphJson(graphJson != null ? graphJson : "{}");
        version.setSettingsJson(settingsJson != null ? settingsJson : "{}");
        version.setCreatedByUserId(uuid(auth.userId()));
        FlowVersion saved = versionRepo.save(version);

        // point flow at the new draft
        flow.setCurrentVersionId(saved.getId());
        flow.setUpdatedByUserId(uuid(auth.userId()));
        flowRepo.save(flow);

        return saved;
    }

    @Transactional
    public FlowVersion updateVersion(AuthContext auth, UUID flowId, UUID versionId, String graphJson, String settingsJson) {
        FlowVersion version = getVersion(auth, flowId, versionId);
        if (!"draft".equals(version.getStatus())) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN, "Only draft versions can be edited");
        }
        if (graphJson != null) version.setGraphJson(graphJson);
        if (settingsJson != null) version.setSettingsJson(settingsJson);
        return versionRepo.save(version);
    }

    @Transactional
    public FlowVersion publish(AuthContext auth, UUID flowId, UUID versionId) {
        Flow flow = get(auth, flowId);
        FlowVersion version = getVersion(auth, flowId, versionId);
        if (!"draft".equals(version.getStatus())) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN, "Only draft versions can be published");
        }
        validateGraphJson(version.getGraphJson());

        version.setStatus("published");
        FlowVersion saved = versionRepo.save(version);

        flow.setStatus("active");
        flow.setCurrentVersionId(saved.getId());
        flow.setUpdatedByUserId(uuid(auth.userId()));
        flowRepo.save(flow);

        return saved;
    }

    private void validateGraphJson(String graphJson) {
        try {
            JsonNode graph = objectMapper.readTree(graphJson);
            JsonNode entryNode = graph.get("entry_node_id");
            JsonNode nodes = graph.get("nodes");
            if (entryNode == null || entryNode.isNull() || entryNode.asText().isBlank()) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "graph_json must contain a non-empty entry_node_id");
            }
            if (nodes == null || !nodes.isObject() || nodes.isEmpty()) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "graph_json must contain at least one node");
            }
        } catch (JsonProcessingException e) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "graph_json is not valid JSON");
        }
    }

    private static UUID uuid(String s) {
        return s != null ? UUID.fromString(s) : null;
    }
}

