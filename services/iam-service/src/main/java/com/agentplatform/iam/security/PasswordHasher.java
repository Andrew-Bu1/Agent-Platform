package com.agentplatform.iam.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

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
}
