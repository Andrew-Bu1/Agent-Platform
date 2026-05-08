package com.agentplatform.iam.api.feature;

import com.agentplatform.iam.entity.Feature;

import java.util.UUID;

public record FeatureDto(
        UUID   id,
        String key,
        String name,
        String description
) {
    public static FeatureDto from(Feature f) {
        return new FeatureDto(f.getId(), f.getKey(), f.getName(), f.getDescription());
    }
}
