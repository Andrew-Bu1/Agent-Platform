package com.agentplatform.iam.service;

import com.agentplatform.common.security.JwtClaims;
import com.agentplatform.iam.entity.IamUser;
import com.agentplatform.iam.entity.ServiceClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds {@link JwtClaims} for token issuance. Does NOT issue tokens itself —
 * that is done by {@link com.agentplatform.iam.security.JwtIssuer}.
 */
@Service
@RequiredArgsConstructor
public class TokenService {

    private static final List<String> USER_DEFAULT_AUD = List.of("studio", "datahub", "aihub");

    private final SigningKeyService signingKeyService;
    private final ObjectMapper      objectMapper;

    /**
     * Returns the JWK Set JSON (public key only) for the JWKS endpoint.
     */
    public String getJwkSetJson() {
        return signingKeyService.getJwkSetJson();
    }

    /**
     * Build access token claims for a human user.
     *
     * @param user        the authenticated user
     * @param tenantId    the tenant context
     * @param workspaceId optional workspace context (may be null)
     * @param permissions collected permission keys
     */
    public JwtClaims buildUserTokenClaims(IamUser user,
                                          UUID tenantId,
                                          UUID workspaceId,
                                          List<String> permissions) {
        Map<String, Object> custom = new LinkedHashMap<>();
        custom.put("tenant_id", tenantId.toString());
        custom.put("user_id", user.getId().toString());
        if (workspaceId != null) {
            custom.put("workspace_id", workspaceId.toString());
        }
        custom.put("permissions", permissions);

        return new JwtClaims(user.getId().toString(), USER_DEFAULT_AUD, custom);
    }

    /**
     * Build access token claims for a service client.
     *
     * @param client      the authenticated service client
     * @param permissions collected permission keys
     */
    @SneakyThrows
    public JwtClaims buildServiceClientTokenClaims(ServiceClient client, List<String> permissions) {
        List<String> audiences = objectMapper.readValue(
                client.getAllowedAudiences(), new TypeReference<List<String>>() {});

        Map<String, Object> custom = new LinkedHashMap<>();
        custom.put("client_id", client.getClientId());
        if (client.getTenantId() != null) {
            custom.put("tenant_id", client.getTenantId().toString());
        }
        custom.put("permissions", permissions);

        return new JwtClaims(client.getClientId(), audiences, custom);
    }
}
