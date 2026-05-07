package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.Feature;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FeatureRepository extends JpaRepository<Feature, UUID> {
    Optional<Feature> findByKey(String key);

    boolean existsByKey(String key);
}
