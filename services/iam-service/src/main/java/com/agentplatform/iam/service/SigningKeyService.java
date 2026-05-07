package com.agentplatform.iam.service;

import com.agentplatform.iam.crypto.AesGcmCipher;
import com.agentplatform.iam.entity.OauthSigningKey;
import com.agentplatform.iam.repository.OauthSigningKeyRepository;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Manages the active RSA signing key stored in {@code oauth_signing_keys}.
 *
 * <p>On startup:
 * <ol>
 *   <li>If no active key exists → generate RSA-2048, encrypt the private JWK, insert row.
 *   <li>Load the active key row, decrypt the private JWK, parse to {@link RSAKey}.
 * </ol>
 *
 * <p>Only IAM service ever calls this. Other services fetch
 * {@code GET /.well-known/jwks.json} and use the public key only.
 *
 * <p>Note: {@code @Transactional} is intentionally absent from {@code init()} —
 * {@code @PostConstruct} runs on the raw bean instance, not through the Spring proxy,
 * so the annotation would be silently ignored. Each repository call carries its own
 * default Spring Data transaction, which is sufficient here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SigningKeyService {

    private final OauthSigningKeyRepository signingKeyRepo;

    /**
     * 32-byte Base64-encoded AES-256 key from env {@code APP_JWT_KEY_ENCRYPTION_SECRET}.
     */
    @Value("${app.jwt.key-encryption-secret}")
    private String keyEncryptionSecret;

    /** Cached active signing key (full, includes private component). */
    private RSAKey activeKey;

    /** Cached public-only JWK Set JSON for the JWKS endpoint. */
    private String jwkSetJson;

    @PostConstruct
    public void init() {
        byte[] encKey = decodeEncryptionSecret(keyEncryptionSecret);

        if (!signingKeyRepo.existsByStatus("active")) {
            log.info("No active signing key found — generating RSA-2048 key pair");
            generateAndPersistKey(encKey);
        }

        loadActiveKey(encKey);
    }

    /** Returns the full RSAKey (public + private) for signing. */
    public RSAKey getActiveKey() {
        return activeKey;
    }

    /** Returns the JWK Set JSON string containing only the public key. */
    public String getJwkSetJson() {
        return jwkSetJson;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void generateAndPersistKey(byte[] encKey) {
        try {
            RSAKey rsaKey = new RSAKeyGenerator(2048)
                    .keyID("iam-rs256-" + OffsetDateTime.now().getYear())
                    .generate();

            String publicJwkJson    = rsaKey.toPublicJWK().toJSONString();
            String privateJwkJson   = rsaKey.toJSONString();
            String encryptedPrivate = AesGcmCipher.encrypt(privateJwkJson, encKey);

            OauthSigningKey row = new OauthSigningKey();
            row.setId(UUID.randomUUID());
            row.setKeyId(rsaKey.getKeyID());
            row.setAlgorithm("RS256");
            row.setPublicJwk(publicJwkJson);
            row.setEncryptedPrivateJwk(encryptedPrivate);
            row.setEncryptionKeyId(null);
            row.setStatus("active");
            row.setNotBefore(OffsetDateTime.now());
            row.setCreatedAt(OffsetDateTime.now());

            signingKeyRepo.save(row);
            log.info("Generated and persisted signing key: {}", rsaKey.getKeyID());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate signing key", e);
        }
    }

    private void loadActiveKey(byte[] encKey) {
        OauthSigningKey row = signingKeyRepo
                .findFirstByStatusAndNotBeforeLessThanEqualOrderByCreatedAtDesc("active", OffsetDateTime.now())
                .orElseThrow(() -> new IllegalStateException("No active signing key found in database"));

        try {
            String privateJwkJson = AesGcmCipher.decrypt(row.getEncryptedPrivateJwk(), encKey);
            activeKey = RSAKey.parse(privateJwkJson);

            RSAKey publicKey = activeKey.toPublicJWK();
            jwkSetJson = new JWKSet(List.of(publicKey)).toString();

            log.info("Loaded active signing key: {}", activeKey.getKeyID());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load active signing key", e);
        }
    }

    private static byte[] decodeEncryptionSecret(String base64Secret) {
        byte[] key = Base64.getDecoder().decode(base64Secret);
        if (key.length != 32) {
            throw new IllegalStateException(
                    "app.jwt.key-encryption-secret must decode to exactly 32 bytes (AES-256). Got: " + key.length);
        }
        return key;
    }
}
