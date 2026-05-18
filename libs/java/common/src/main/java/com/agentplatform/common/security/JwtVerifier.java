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
import java.util.List;

/**
 * RS256 JWT verifier — all services use this to validate tokens issued by IAM.
 *
 * <p>Two modes:
 * <ul>
 *   <li><b>Static</b> — pass a fixed {@link RSAKey}. Simple, but breaks on key rotation.
 *   <li><b>Dynamic</b> — pass a {@link JwksClient}. Keys are looked up by {@code kid}
 *       and refreshed on-demand, so key rotation is transparent.
 * </ul>
 *
 * Prefer the dynamic constructor for long-running services.
 */
public class JwtVerifier {

    private final RSAKey staticKey;
    private final JwksClient jwksClient;

    /** Static mode: verifies against a fixed public key. */
    public JwtVerifier(RSAKey publicKey) {
        this.staticKey = publicKey.toPublicJWK();
        this.jwksClient = null;
    }

    /** Dynamic mode: resolves the signing key from the JWKS endpoint by {@code kid}. */
    public JwtVerifier(JwksClient jwksClient) {
        this.staticKey = null;
        this.jwksClient = jwksClient;
    }

    public JWTClaimsSet verify(String token) {
        return verify(token, null, null);
    }

    public JWTClaimsSet verify(String token, String expectedIssuer, String expectedAudience) {
        SignedJWT jwt;
        try {
            jwt = SignedJWT.parse(token);
        } catch (ParseException e) {
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Malformed JWT");
        }

        RSAKey key = resolveKey(jwt);

        try {
            RSAPublicKey rsaPublicKey = key.toRSAPublicKey();
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

        if (expectedIssuer != null && !expectedIssuer.equals(claims.getIssuer())) {
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Invalid token issuer");
        }

        if (expectedAudience != null) {
            List<String> aud = claims.getAudience();
            if (aud == null || !aud.contains(expectedAudience)) {
                throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Token not valid for this audience");
            }
        }

        return claims;
    }

    private RSAKey resolveKey(SignedJWT jwt) {
        if (jwksClient != null) {
            String kid = jwt.getHeader().getKeyID();
            if (kid == null || kid.isBlank()) {
                throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Token missing key ID");
            }
            RSAKey key = jwksClient.getKey(kid);
            if (key == null) {
                throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Unknown signing key");
            }
            return key;
        }
        return staticKey;
    }

    /** Returns the static public JWK (only valid in static mode). */
    public RSAKey getPublicJwk() {
        return staticKey;
    }
}
