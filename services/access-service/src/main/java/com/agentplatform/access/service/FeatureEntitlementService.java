package com.agentplatform.access.service;

import com.agentplatform.access.dto.CreateFeatureEntitlementRequest;
import com.agentplatform.access.dto.FeatureEntitlementResponse;
import com.agentplatform.access.dto.UpdateFeatureEntitlementRequest;
import com.agentplatform.access.entity.FeatureEntitlement;
import com.agentplatform.access.entity.Tenant;
import com.agentplatform.access.repository.FeatureEntitlementRepository;
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
public class FeatureEntitlementService {

    private final FeatureEntitlementRepository featureEntitlementRepository;
    private final TenantRepository tenantRepository;
    private final AuditLogService auditLogService;

    public Page<FeatureEntitlementResponse> listByTenant(UUID tenantId, Pageable pageable) {
        Tenant tenant = findTenantOrThrow(tenantId);
        return featureEntitlementRepository.findByTenant(tenant, pageable).map(FeatureEntitlementResponse::from);
    }

    public FeatureEntitlementResponse get(UUID id) {
        return featureEntitlementRepository.findById(id)
                .map(FeatureEntitlementResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Feature entitlement not found"));
    }

    @Transactional
    public FeatureEntitlementResponse create(UUID tenantId, CreateFeatureEntitlementRequest request) {
        Tenant tenant = findTenantOrThrow(tenantId);
        if (featureEntitlementRepository.existsByTenantAndFeatureKey(tenant, request.getFeatureKey())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Feature entitlement already exists for key: " + request.getFeatureKey());
        }
        FeatureEntitlement fe = FeatureEntitlement.builder()
                .id(UUID.randomUUID())
                .tenant(tenant)
                .featureKey(request.getFeatureKey())
                .enabled(request.getEnabled() != null ? request.getEnabled() : true)
                .config(request.getConfig() != null ? request.getConfig() : "{}")
                .build();
        FeatureEntitlement saved = featureEntitlementRepository.save(fe);
        auditLogService.log("user", actorId(), tenantId,
                "feature_entitlement:create", "feature_entitlement", saved.getId().toString());
        return FeatureEntitlementResponse.from(saved);
    }

    @Transactional
    public FeatureEntitlementResponse update(UUID id, UpdateFeatureEntitlementRequest request) {
        FeatureEntitlement fe = featureEntitlementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Feature entitlement not found"));
        if (request.getEnabled() != null) fe.setEnabled(request.getEnabled());
        if (request.getConfig() != null) fe.setConfig(request.getConfig());
        FeatureEntitlement saved = featureEntitlementRepository.save(fe);
        auditLogService.log("user", actorId(), fe.getTenant().getId(),
                "feature_entitlement:update", "feature_entitlement", id.toString());
        return FeatureEntitlementResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        FeatureEntitlement fe = featureEntitlementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Feature entitlement not found"));
        UUID tenantId = fe.getTenant().getId();
        featureEntitlementRepository.deleteById(id);
        auditLogService.log("user", actorId(), tenantId,
                "feature_entitlement:delete", "feature_entitlement", id.toString());
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
