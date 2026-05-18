package com.agentplatform.iam.service;

import com.agentplatform.common.security.JwtClaims;
import com.agentplatform.iam.entity.IamUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class TokenServiceTest {

    @Mock
    private SigningKeyService signingKeyService;

    private TokenService tokenService;

    private static final UUID TENANT_ID    = UUID.fromString("00000000-0000-0000-0003-000000000001");
    private static final UUID WORKSPACE_ID = UUID.fromString("00000000-0000-0000-0005-000000000001");
    private static final UUID USER_ID      = UUID.fromString("00000000-0000-0000-0002-000000000001");

    @BeforeEach
    void setUp() {
        tokenService = new TokenService(signingKeyService);
    }

    // ── Audience tests ───────────────────────────────────────────────────────

    @Test
    void userToken_includesAllExpectedAudiences() {
        JwtClaims claims = buildUserClaims(List.of("agent:run"));

        assertThat(claims.audiences())
                .containsExactlyInAnyOrder("studio", "datahub", "aihub", "agent-orchestrator");
    }

    @Test
    void userToken_includesAgentOrchestratorAudience() {
        JwtClaims claims = buildUserClaims(List.of());

        assertThat(claims.audiences()).contains("agent-orchestrator");
    }

    // ── Custom claims tests ──────────────────────────────────────────────────

    @Test
    void userToken_subjectIsUserId() {
        JwtClaims claims = buildUserClaims(List.of());

        assertThat(claims.subject()).isEqualTo(USER_ID.toString());
    }

    @Test
    void userToken_containsTenantId() {
        JwtClaims claims = buildUserClaims(List.of());

        assertThat(claims.customClaims()).containsEntry("tenant_id", TENANT_ID.toString());
    }

    @Test
    void userToken_containsWorkspaceId() {
        JwtClaims claims = buildUserClaims(List.of());

        assertThat(claims.customClaims()).containsEntry("workspace_id", WORKSPACE_ID.toString());
    }

    @Test
    void userToken_typeIsUser() {
        JwtClaims claims = buildUserClaims(List.of());

        assertThat(claims.customClaims()).containsEntry("type", "user");
    }

    @Test
    void userToken_permissionsAreIncluded() {
        List<String> perms = List.of("agent:run", "model:invoke", "flow:run");
        JwtClaims claims = buildUserClaims(perms);

        assertThat(claims.customClaims()).containsKey("permissions");
        @SuppressWarnings("unchecked")
        List<String> tokenPerms = (List<String>) claims.customClaims().get("permissions");
        assertThat(tokenPerms).containsExactlyInAnyOrderElementsOf(perms);
    }

    @Test
    void userToken_emptyPermissionsAllowed() {
        JwtClaims claims = buildUserClaims(List.of());

        @SuppressWarnings("unchecked")
        List<String> tokenPerms = (List<String>) claims.customClaims().get("permissions");
        assertThat(tokenPerms).isEmpty();
    }

    @Test
    void userToken_nullWorkspaceOmitted() {
        IamUser user = newUser();
        JwtClaims claims = tokenService.buildUserTokenClaims(user, TENANT_ID, null, List.of());

        assertThat(claims.customClaims()).doesNotContainKey("workspace_id");
    }

    // ── Service client token tests ───────────────────────────────────────────

    @Test
    void serviceClientToken_typeIsServiceClient() {
        com.agentplatform.iam.entity.ServiceClient client = new com.agentplatform.iam.entity.ServiceClient();
        ReflectionTestUtils.setField(client, "clientId", "my-service");
        ReflectionTestUtils.setField(client, "tenantId", TENANT_ID);
        ReflectionTestUtils.setField(client, "allowedAudiences", List.of("agent-orchestrator"));

        JwtClaims claims = tokenService.buildServiceClientTokenClaims(client, List.of("agent:run"));

        assertThat(claims.customClaims()).containsEntry("type", "service_client");
        assertThat(claims.audiences()).contains("agent-orchestrator");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private JwtClaims buildUserClaims(List<String> permissions) {
        return tokenService.buildUserTokenClaims(newUser(), TENANT_ID, WORKSPACE_ID, permissions);
    }

    private static IamUser newUser() {
        IamUser user = new IamUser();
        ReflectionTestUtils.setField(user, "id", USER_ID);
        return user;
    }
}
