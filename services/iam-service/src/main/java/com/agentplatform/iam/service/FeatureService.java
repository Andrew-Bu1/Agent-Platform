package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.iam.entity.Feature;
import com.agentplatform.iam.repository.FeatureEntitlementRepository;
import com.agentplatform.iam.repository.FeatureRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeatureService {

    private final FeatureRepository            featureRepo;
    private final FeatureEntitlementRepository featureEntitlementRepo;
    private final TenantService                tenantService;

    @Transactional(readOnly = true)
    public List<Feature> listFeatures() {
        return featureRepo.findAll();
    }

    @Transactional(readOnly = true)
    public Feature getFeature(UUID id) {
        return featureRepo.findById(id)
                .orElseThrow(() -> new NotFoundException(ErrorCode.NOT_FOUND,
                        "Feature not found: " + id));
    }

    @Transactional
    public Feature createFeature(UUID userId, String key, String name, String description) {
        tenantService.requirePlatformAdmin(userId);
        if (featureRepo.existsByKey(key)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Feature key already exists: " + key);
        }
        Feature f = new Feature();
        f.setId(UUID.randomUUID());
        f.setKey(key);
        f.setName(name);
        f.setDescription(description);
        f.setCreatedAt(OffsetDateTime.now());
        return featureRepo.save(f);
    }

    @Transactional
    public Feature updateFeature(UUID userId, UUID id, String name, String description) {
        tenantService.requirePlatformAdmin(userId);
        Feature f = getFeature(id);
        if (name != null)        f.setName(name);
        if (description != null) f.setDescription(description);
        return featureRepo.save(f);
    }

    @Transactional
    public void deleteFeature(UUID userId, UUID id) {
        tenantService.requirePlatformAdmin(userId);
        Feature f = getFeature(id);
        if (featureEntitlementRepo.existsByFeatureId(id)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Feature still has active entitlements and cannot be deleted");
        }
        featureRepo.delete(f);
    }
}
