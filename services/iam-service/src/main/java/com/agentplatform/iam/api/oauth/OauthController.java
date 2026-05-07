package com.agentplatform.iam.api.oauth;

import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.UnauthorizedException;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.service.OauthService;
import com.agentplatform.iam.service.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class OauthController {

    private final OauthService oauthService;
    private final TokenService tokenService;

    /**
     * OAuth2 Token endpoint (client_credentials grant).
     * Accepts application/x-www-form-urlencoded as per RFC 6749.
     */
    @PostMapping(value = "/oauth/token", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<TokenResponse> token(
            @RequestParam("grant_type") String grantType,
            @RequestParam("client_id") String clientId,
            @RequestParam("client_secret") String clientSecret) {

        if (!"client_credentials".equals(grantType)) {
            throw new UnauthorizedException(ErrorCode.INVALID_REQUEST,
                    "Only grant_type=client_credentials is supported");
        }

        OauthService.TokenResult result = oauthService.clientCredentials(clientId, clientSecret);
        return ResponseEntity.ok(new TokenResponse(
                result.accessToken(), "Bearer", result.expiresIn()));
    }

    /**
     * JWKS endpoint — returns the active public signing key set.
     * Other services use this to verify JWT signatures.
     */
    @GetMapping(value = "/.well-known/jwks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> jwks() {
        return ResponseEntity.ok(tokenService.getJwkSetJson());
    }
}
