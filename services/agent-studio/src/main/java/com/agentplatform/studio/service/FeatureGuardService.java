package com.agentplatform.studio.service;

import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.security.AuthContext;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Checks tenant feature entitlements via IAM and caches results per tenant for 5 minutes.
 * Fails open (allows the request) when IAM is unreachable to preserve availability.
 */
@Service
@RequiredArgsConstructor
public class FeatureGuardService {

    private static final long CACHE_TTL_SECONDS = 300;

    @Qualifier("iamClient")
    private final RestClient iamClient;

    private record CacheEntry(Set<String> features, Instant fetchedAt) {}

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    /**
     * Throws {@link ForbiddenException} if the tenant does not have {@code featureKey} enabled.
     * If IAM is unreachable the request is allowed through (fail-open).
     */
    public void require(AuthContext auth, String featureKey) {
        Set<String> features = getFeatures(auth.tenantId());
        if (features == null) {
            // IAM unreachable – fail open to preserve availability
            return;
        }
        if (!features.contains(featureKey)) {
            throw new ForbiddenException("Feature not enabled for this tenant: '" + featureKey + "'");
        }
    }

    private Set<String> getFeatures(String tenantId) {
        CacheEntry entry = cache.get(tenantId);
        if (entry != null && Instant.now().isBefore(entry.fetchedAt().plusSeconds(CACHE_TTL_SECONDS))) {
            return entry.features();
        }

        try {
            JsonNode body = iamClient.get()
                    .uri("/entitlements/features")
                    .retrieve()
                    .body(JsonNode.class);

            Set<String> features = new HashSet<>();
            if (body != null && body.has("data")) {
                for (JsonNode item : body.get("data")) {
                    if (item.path("enabled").asBoolean(false)) {
                        String key = item.path("featureKey").asText("");
                        if (!key.isEmpty()) {
                            features.add(key);
                        }
                    }
                }
            }
            cache.put(tenantId, new CacheEntry(features, Instant.now()));
            return features;
        } catch (RestClientException e) {
            // Fail open: return null so require() lets the request through.
            return null;
        }
    }
}
