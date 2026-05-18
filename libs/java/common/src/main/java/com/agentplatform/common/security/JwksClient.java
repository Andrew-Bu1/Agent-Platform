package com.agentplatform.common.security;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Fetches and caches RSA public keys from an IAM JWKS endpoint.
 *
 * <p>Keys are loaded eagerly at construction, then refreshed on-demand when an
 * unknown {@code kid} is encountered. Re-fetches are rate-limited to at most
 * once per {@value #MIN_REFRESH_SECONDS} seconds to prevent a DoS on IAM via
 * tokens carrying random key IDs.
 */
@Slf4j
public class JwksClient {

    static final int MIN_REFRESH_SECONDS = 60;

    private final String jwksUrl;
    private final HttpClient http;
    private final ConcurrentHashMap<String, RSAKey> cache = new ConcurrentHashMap<>();
    private final ReentrantLock loadLock = new ReentrantLock();
    private volatile Instant lastFetch = Instant.EPOCH;

    public JwksClient(String jwksUrl) {
        this.jwksUrl = jwksUrl;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        load();
    }

    /**
     * Returns the public RSA key for the given {@code kid}, or {@code null} when
     * the key is unknown and the re-fetch rate limit has not yet elapsed.
     */
    public RSAKey getKey(String kid) {
        RSAKey key = cache.get(kid);
        if (key != null) {
            return key;
        }

        // Serialize refresh attempts so only one thread hits IAM at a time.
        loadLock.lock();
        try {
            // Double-check: another thread may have fetched while we waited.
            key = cache.get(kid);
            if (key != null) {
                return key;
            }

            if (Duration.between(lastFetch, Instant.now()).getSeconds() < MIN_REFRESH_SECONDS) {
                log.debug("JWKS re-fetch rate-limited; unknown kid={}", kid);
                return null;
            }

            load();
        } finally {
            loadLock.unlock();
        }

        return cache.get(kid);
    }

    private void load() {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(jwksUrl))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("JWKS fetch returned HTTP {}; keeping existing keys", resp.statusCode());
                return;
            }

            JWKSet jwkSet = JWKSet.parse(resp.body());
            ConcurrentHashMap<String, RSAKey> updated = new ConcurrentHashMap<>();
            jwkSet.getKeys().stream()
                    .filter(k -> k instanceof RSAKey && k.getKeyID() != null)
                    .forEach(k -> updated.put(k.getKeyID(), (RSAKey) k.toPublicJWK()));

            cache.putAll(updated);
            // Remove stale kids that are no longer in the JWKS
            cache.keySet().retainAll(updated.keySet());

            lastFetch = Instant.now();
            log.info("Loaded {} key(s) from {}", updated.size(), jwksUrl);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("JWKS fetch interrupted");
        } catch (Exception e) {
            log.warn("Failed to fetch JWKS from {}: {}", jwksUrl, e.getMessage());
        }
    }
}
