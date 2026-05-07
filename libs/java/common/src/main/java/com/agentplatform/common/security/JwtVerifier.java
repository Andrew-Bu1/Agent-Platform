package com.agentplatform.common.security;

import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.UnauthorizedException;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import java.security.interfaces.RSAPublicKey;
import java.text.ParseException;
import java.util.Date;

/**
 * RS256 JWT verifier — all services use this to validate tokens issued by IAM.
 *
 * <p>Wire up as a {@code @Bean} using the IAM public key, for example:
 * <pre>
 * &#64;Bean
 * public JwtVerifier jwtVerifier(JwtProperties props, ResourceLoader loader) throws Exception {
 *     RSAPublicKey pub = JwtKeyLoader.loadPublicKey(loader.getResource(props.getPublicKeyPath()));
 *     RSAKey rsaKey = new RSAKey.Builder(pub).keyID(props.getKeyId()).build();
 *     return new JwtVerifier(rsaKey);
 * }
 * </pre>
 */
public class JwtVerifier {

    private final RSAKey publicKey;

    public JwtVerifier(RSAKey publicKey) {
        this.publicKey = publicKey.toPublicJWK(); // ensure no private key material is held
    }

    /**
     * Parse and verify a compact JWT string.
     *
     * @param token compact serialized JWT
     * @return verified {@link JWTClaimsSet}
     * @throws UnauthorizedException if the token is malformed, has an invalid signature, or is expired
     */
    public JWTClaimsSet verify(String token) {
        SignedJWT jwt;
        try {
            jwt = SignedJWT.parse(token);
        } catch (ParseException e) {
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Malformed JWT");
        }

        try {
            RSAPublicKey rsaPublicKey = publicKey.toRSAPublicKey();
            RSASSAVerifier verifier = new RSASSAVerifier(rsaPublicKey);
            if (!jwt.verify(verifier)) {
                throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "JWT signature verification failed");
            }
        } catch (JOSEException e) {
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "JWT verification error: " + e.getMessage());
        }

        JWTClaimsSet claims;
        try {
            claims = jwt.getJWTClaimsSet();
        } catch (ParseException e) {
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Could not parse JWT claims");
        }

        Date expiry = claims.getExpirationTime();
        if (expiry != null && expiry.before(new Date())) {
            throw new UnauthorizedException(ErrorCode.TOKEN_EXPIRED, "JWT has expired");
        }

        return claims;
    }

    /** Returns the public JWK — safe to expose on a JWKS endpoint if needed. */
    public RSAKey getPublicJwk() {
        return publicKey;
    }
}
