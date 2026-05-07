package com.agentplatform.common.security;

import org.springframework.core.io.Resource;
import org.springframework.security.converter.RsaKeyConverters;

import java.io.IOException;
import java.io.InputStream;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

/**
 * Utility for loading RSA keys from PEM-encoded resources.
 * Uses Spring Security's built-in {@link RsaKeyConverters} — no extra dependencies required.
 *
 * <p>Expected PEM formats:
 * <ul>
 *   <li>Public  key: X.509 / SPKI  ({@code -----BEGIN PUBLIC KEY-----})</li>
 *   <li>Private key: PKCS#8        ({@code -----BEGIN PRIVATE KEY-----})</li>
 * </ul>
 */
public final class JwtKeyLoader {

    private JwtKeyLoader() {}

    /**
     * Load an RSA public key from a Spring {@link Resource} (classpath, file, etc.).
     */
    public static RSAPublicKey loadPublicKey(Resource resource) throws IOException {
        try (InputStream in = resource.getInputStream()) {
            return RsaKeyConverters.x509().convert(in);
        }
    }

    /**
     * Load an RSA private key from a Spring {@link Resource} (PKCS#8 PEM format).
     */
    public static RSAPrivateKey loadPrivateKey(Resource resource) throws IOException {
        try (InputStream in = resource.getInputStream()) {
            return RsaKeyConverters.pkcs8().convert(in);
        }
    }
}
