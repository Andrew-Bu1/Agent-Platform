package com.agentplatform.iam.service;

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

    public record FeatureEntitlementView(String featureKey, String featureName, boolean enabled) {}

    public record ModelEntitlementView(
            String modelKey, String operationType, boolean allowed,
            Integer rpmLimit, Integer tpmLimit,
            Long dailyTokenLimit, Long monthlyTokenLimit) {}

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
    public List<ModelEntitlementView> getModelEntitlements(UUID tenantId) {
        return modelEntitlementRepo.findByTenantIdAndAllowedTrue(tenantId).stream()
                .map(m -> new ModelEntitlementView(
                        m.getModelKey(), m.getOperationType(), m.isAllowed(),
                        m.getRpmLimit(), m.getTpmLimit(),
                        m.getDailyTokenLimit(), m.getMonthlyTokenLimit()))
                .collect(Collectors.toList());
    }
}
