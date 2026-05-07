package com.agentplatform.iam.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * BCrypt password utility — IAM-only.
 *
 * <p>Used for:
 * <ul>
 *   <li>Hashing and verifying user passwords (table: {@code users.password_hash})</li>
 *   <li>Hashing and verifying service client secrets (table: {@code service_clients.secret_hash})</li>
 *   <li>Hashing refresh tokens before persistence (future: {@code refresh_tokens.token_hash})</li>
 * </ul>
 *
 * <p>Algorithm identifier stored in DB columns {@code password_algorithm} / {@code secret_algorithm}
 * as {@code "bcrypt"}.
 */
public final class PasswordHasher {

    private static final PasswordEncoder BCRYPT = new BCryptPasswordEncoder();

    private PasswordHasher() {}

    /** Hash a raw plaintext secret using BCrypt. */
    public static String hash(String raw) {
        return BCRYPT.encode(raw);
    }

    /** Verify a raw plaintext secret against a stored BCrypt hash. */
    public static boolean verify(String raw, String hash) {
        return BCRYPT.matches(raw, hash);
    }

    /**
     * Hash a session/refresh token using SHA-256.
     * Tokens are high-entropy JWTs; BCrypt's brute-force resistance is unnecessary
     * and its intentional slowness creates a CPU bottleneck during token refresh.
     */
    public static String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /**
     * Constant-time comparison of a raw token against a stored SHA-256 hash.
     */
    public static boolean verifyToken(String rawToken, String storedHash) {
        String computed = hashToken(rawToken);
        return MessageDigest.isEqual(
                computed.getBytes(StandardCharsets.UTF_8),
                storedHash.getBytes(StandardCharsets.UTF_8));
    }
}
