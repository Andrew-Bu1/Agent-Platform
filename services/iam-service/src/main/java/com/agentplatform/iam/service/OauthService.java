package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.UnauthorizedException;
import com.agentplatform.common.security.JwtClaims;
import com.agentplatform.iam.entity.ServiceClient;
import com.agentplatform.iam.repository.ServiceClientRepository;
import com.agentplatform.iam.security.JwtIssuer;
import com.agentplatform.iam.security.PasswordHasher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OauthService {

    private final ServiceClientRepository serviceClientRepo;
    private final PermissionService       permissionService;
    private final TokenService            tokenService;
    private final JwtIssuer               jwtIssuer;

    public record TokenResult(String accessToken, int expiresIn) {}

    /**
     * OAuth2 client_credentials grant.
     *
     * @param clientId     service client identifier
     * @param clientSecret plain-text secret (verified against BCrypt hash)
     */
    @Transactional(readOnly = true)
    public TokenResult clientCredentials(String clientId, String clientSecret) {
        ServiceClient client = serviceClientRepo.findByClientIdAndIsActiveTrue(clientId)
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.SERVICE_CLIENT_NOT_FOUND,
                        "Unknown or inactive service client"));

        if (!PasswordHasher.verify(clientSecret, client.getSecretHash())) {
            throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS, "Invalid client secret");
        }

        List<String> permissions = permissionService.collectServiceClientPermissions(clientId, client.getTenantId());
        JwtClaims claims = tokenService.buildServiceClientTokenClaims(client, permissions);
        String accessToken = jwtIssuer.issueAccessToken(claims);

        return new TokenResult(accessToken, client.getAccessTokenTtlSeconds());
    }
}
