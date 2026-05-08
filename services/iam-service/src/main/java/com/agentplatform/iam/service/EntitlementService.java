package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.iam.entity.Feature;
import com.agentplatform.iam.entity.FeatureEntitlement;
import com.agentplatform.iam.entity.ModelEntitlement;
import com.agentplatform.iam.repository.FeatureEntitlementRepository;
import com.agentplatform.iam.repository.FeatureRepository;
import com.agentplatform.iam.repository.ModelEntitlementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EntitlementService {

    private final FeatureEntitlementRepository featureEntitlementRepo;
    private final ModelEntitlementRepository   modelEntitlementRepo;
    private final FeatureRepository            featureRepo;
    private final TenantService                tenantService;

    // ── View records ──────────────────────────────────────────────────────────

    public record FeatureEntitlementView(String featureKey, String featureName, boolean enabled) {}

    public record ModelEntitlementView(
            String modelKey, String operationType, boolean allowed,
            Integer rpmLimit, Integer tpmLimit,
            Long dailyTokenLimit, Long monthlyTokenLimit) {}

    // ── Feature entitlements ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FeatureEntitlementView> getFeatureEntitlements(UUID tenantId) {
        List<FeatureEntitlement> entitlements = featureEntitlementRepo.findEnabledByTenantId(tenantId);
        Map<UUID, Feature> features = featureRepo.findAllById(
                entitlements.stream().map(FeatureEntitlement::getFeatureId).collect(Collectors.toList())
        ).stream().collect(Collectors.toMap(Feature::getId, Function.identity()));

        return entitlements.stream()
                .filter(e -> features.containsKey(e.getFeatureId()))
                .map(e -> {
                    Feature f = features.get(e.getFeatureId());
                    return new FeatureEntitlementView(f.getKey(), f.getName(), e.isEnabled());
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<FeatureEntitlement> listFeatureEntitlements(UUID tenantId) {
        return featureEntitlementRepo.findByTenantId(tenantId);
    }

    @Transactional
    public FeatureEntitlement grantFeatureEntitlement(UUID userId, UUID tenantId, String featureKey,
                                                       boolean enabled, String config) {
        tenantService.requirePlatformAdmin(userId);
        Feature feature = featureRepo.findByKey(featureKey)
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND,
                        "Feature not found: " + featureKey));

        if (featureEntitlementRepo.existsByTenantIdAndFeatureId(tenantId, feature.getId())) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Feature entitlement already exists for this tenant");
        }

        FeatureEntitlement e = new FeatureEntitlement();
        e.setTenantId(tenantId);
        e.setFeatureId(feature.getId());
        e.setEnabled(enabled);
        e.setConfig(config != null ? config : "{}");
        return featureEntitlementRepo.save(e);
    }

    @Transactional
    public FeatureEntitlement updateFeatureEntitlement(UUID userId, UUID tenantId, UUID featureId,
                                                        boolean enabled, String config) {
        tenantService.requirePlatformAdmin(userId);
        FeatureEntitlement e = featureEntitlementRepo.findByTenantIdAndFeatureId(tenantId, featureId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND,
                        "Feature entitlement not found"));
        e.setEnabled(enabled);
        if (config != null) {
            e.setConfig(config);
        }
        return featureEntitlementRepo.save(e);
    }

    @Transactional
    public void revokeFeatureEntitlement(UUID userId, UUID tenantId, UUID featureId) {
        tenantService.requirePlatformAdmin(userId);
        FeatureEntitlement e = featureEntitlementRepo.findByTenantIdAndFeatureId(tenantId, featureId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND,
                        "Feature entitlement not found"));
        featureEntitlementRepo.delete(e);
    }

    // ── Model entitlements ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ModelEntitlementView> getModelEntitlements(UUID tenantId) {
        return modelEntitlementRepo.findByTenantIdAndAllowedTrue(tenantId).stream()
                .map(m -> new ModelEntitlementView(
                        m.getModelKey(), m.getOperationType(), m.isAllowed(),
                        m.getRpmLimit(), m.getTpmLimit(),
                        m.getDailyTokenLimit(), m.getMonthlyTokenLimit()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ModelEntitlement> listModelEntitlements(UUID tenantId) {
        return modelEntitlementRepo.findByTenantId(tenantId);
    }

    @Transactional
    public ModelEntitlement grantModelEntitlement(UUID userId, UUID tenantId, String modelKey,
                                                   String operationType, boolean allowed,
                                                   Integer rpmLimit, Integer tpmLimit,
                                                   Long dailyTokenLimit, Long monthlyTokenLimit,
                                                   String config) {
        tenantService.requirePlatformAdmin(userId);
        if (modelEntitlementRepo.existsByTenantIdAndModelKeyAndOperationType(
                tenantId, modelKey, operationType)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Model entitlement already exists for key=" + modelKey
                            + " operationType=" + operationType);
        }

        ModelEntitlement m = new ModelEntitlement();
        m.setTenantId(tenantId);
        m.setModelKey(modelKey);
        m.setOperationType(operationType);
        m.setAllowed(allowed);
        m.setRpmLimit(rpmLimit);
        m.setTpmLimit(tpmLimit);
        m.setDailyTokenLimit(dailyTokenLimit);
        m.setMonthlyTokenLimit(monthlyTokenLimit);
        m.setConfig(config != null ? config : "{}");
        return modelEntitlementRepo.save(m);
    }

    @Transactional
    public ModelEntitlement updateModelEntitlement(UUID userId, UUID tenantId, UUID id,
                                                    Boolean allowed,
                                                    Integer rpmLimit, Integer tpmLimit,
                                                    Long dailyTokenLimit, Long monthlyTokenLimit,
                                                    String config) {
        tenantService.requirePlatformAdmin(userId);
        ModelEntitlement m = modelEntitlementRepo.findById(id)
                .filter(e -> tenantId.equals(e.getTenantId()))
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND,
                        "Model entitlement not found: " + id));

        if (allowed != null)            m.setAllowed(allowed);
        if (rpmLimit != null)           m.setRpmLimit(rpmLimit);
        if (tpmLimit != null)           m.setTpmLimit(tpmLimit);
        if (dailyTokenLimit != null)    m.setDailyTokenLimit(dailyTokenLimit);
        if (monthlyTokenLimit != null)  m.setMonthlyTokenLimit(monthlyTokenLimit);
        if (config != null)             m.setConfig(config);
        return modelEntitlementRepo.save(m);
    }

    @Transactional
    public void revokeModelEntitlement(UUID userId, UUID tenantId, UUID id) {
        tenantService.requirePlatformAdmin(userId);
        ModelEntitlement m = modelEntitlementRepo.findById(id)
                .filter(e -> tenantId.equals(e.getTenantId()))
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND,
                        "Model entitlement not found: " + id));
        modelEntitlementRepo.delete(m);
    }
}
