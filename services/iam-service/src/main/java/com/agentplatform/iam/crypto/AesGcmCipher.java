package com.agentplatform.iam.crypto;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encrypt/decrypt utility.
 *
 * <p>Ciphertext format: {@code BASE64(IV):BASE64(ciphertext+authTag)}
 * <p>The 128-bit GCM auth tag is appended to the ciphertext by Java's crypto API automatically.
 */
public final class AesGcmCipher {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int    IV_LENGTH_BYTES  = 12;
    private static final int    TAG_LENGTH_BITS  = 128;

    private AesGcmCipher() {}

    /**
     * Encrypt {@code plaintext} with the given 32-byte AES key.
     *
     * @param plaintext cleartext string (UTF-8)
     * @param keyBytes  exactly 32 bytes (AES-256)
     * @return opaque ciphertext string safe to store in the DB
     */
    public static String encrypt(String plaintext, byte[] keyBytes) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(keyBytes, "AES"),
                    new GCMParameterSpec(TAG_LENGTH_BITS, iv));

            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(iv)
                    + ":" + Base64.getEncoder().encodeToString(ciphertext);
        } catch (Exception e) {
            throw new IllegalStateException("AES-GCM encrypt failed", e);
        }
    }

    /**
     * Decrypt a ciphertext produced by {@link #encrypt}.
     *
     * @param ciphertext opaque string from the DB
     * @param keyBytes   exactly 32 bytes (AES-256)
     * @return original plaintext string
     */
    public static String decrypt(String ciphertext, byte[] keyBytes) {
        try {
            String[] parts = ciphertext.split(":", 2);
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid ciphertext format");
            }
            byte[] iv         = Base64.getDecoder().decode(parts[0]);
            byte[] ciphertextBytes = Base64.getDecoder().decode(parts[1]);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(keyBytes, "AES"),
                    new GCMParameterSpec(TAG_LENGTH_BITS, iv));

            byte[] plaintext = cipher.doFinal(ciphertextBytes);
            return new String(plaintext, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("AES-GCM decrypt failed", e);
        }
    }
}
