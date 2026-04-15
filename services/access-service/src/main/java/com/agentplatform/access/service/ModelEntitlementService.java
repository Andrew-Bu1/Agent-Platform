package com.agentplatform.access.service;

import com.agentplatform.access.dto.CreateModelEntitlementRequest;
import com.agentplatform.access.dto.ModelEntitlementResponse;
import com.agentplatform.access.dto.UpdateModelEntitlementRequest;
import com.agentplatform.access.entity.ModelEntitlement;
import com.agentplatform.access.entity.Tenant;
import com.agentplatform.access.repository.ModelEntitlementRepository;
import com.agentplatform.access.repository.TenantRepository;
import com.agentplatform.access.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ModelEntitlementService {

    private final ModelEntitlementRepository modelEntitlementRepository;
    private final TenantRepository tenantRepository;
    private final AuditLogService auditLogService;

    public Page<ModelEntitlementResponse> listByTenant(UUID tenantId, Pageable pageable) {
        Tenant tenant = findTenantOrThrow(tenantId);
        return modelEntitlementRepository.findByTenant(tenant, pageable).map(ModelEntitlementResponse::from);
    }

    public ModelEntitlementResponse get(UUID id) {
        return modelEntitlementRepository.findById(id)
                .map(ModelEntitlementResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Model entitlement not found"));
    }

    @Transactional
    public ModelEntitlementResponse create(UUID tenantId, CreateModelEntitlementRequest request) {
        Tenant tenant = findTenantOrThrow(tenantId);
        if (modelEntitlementRepository.existsByTenantAndModelKeyAndOperationType(
                tenant, request.getModelKey(), request.getOperationType())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Model entitlement already exists for model=" + request.getModelKey()
                            + " operation=" + request.getOperationType());
        }
        ModelEntitlement me = ModelEntitlement.builder()
                .id(UUID.randomUUID())
                .tenant(tenant)
                .modelKey(request.getModelKey())
                .operationType(request.getOperationType())
                .allowed(request.getAllowed() != null ? request.getAllowed() : true)
                .rpmLimit(request.getRpmLimit())
                .tpmLimit(request.getTpmLimit())
                .dailyTokenLimit(request.getDailyTokenLimit())
                .monthlyTokenLimit(request.getMonthlyTokenLimit())
                .config(request.getConfig() != null ? request.getConfig() : "{}")
                .build();
        ModelEntitlement saved = modelEntitlementRepository.save(me);
        auditLogService.log("user", actorId(), tenantId,
                "model_entitlement:create", "model_entitlement", saved.getId().toString());
        return ModelEntitlementResponse.from(saved);
    }

    @Transactional
    public ModelEntitlementResponse update(UUID id, UpdateModelEntitlementRequest request) {
        ModelEntitlement me = modelEntitlementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Model entitlement not found"));
        if (request.getAllowed() != null) me.setAllowed(request.getAllowed());
        if (request.getRpmLimit() != null) me.setRpmLimit(request.getRpmLimit());
        if (request.getTpmLimit() != null) me.setTpmLimit(request.getTpmLimit());
        if (request.getDailyTokenLimit() != null) me.setDailyTokenLimit(request.getDailyTokenLimit());
        if (request.getMonthlyTokenLimit() != null) me.setMonthlyTokenLimit(request.getMonthlyTokenLimit());
        if (request.getConfig() != null) me.setConfig(request.getConfig());
        ModelEntitlement saved = modelEntitlementRepository.save(me);
        auditLogService.log("user", actorId(), me.getTenant().getId(),
                "model_entitlement:update", "model_entitlement", id.toString());
        return ModelEntitlementResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        ModelEntitlement me = modelEntitlementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Model entitlement not found"));
        UUID tenantId = me.getTenant().getId();
        modelEntitlementRepository.deleteById(id);
        auditLogService.log("user", actorId(), tenantId,
                "model_entitlement:delete", "model_entitlement", id.toString());
    }

    private Tenant findTenantOrThrow(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));
    }

    private String actorId() {
        try {
            return SecurityUtils.currentUserId().toString();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
