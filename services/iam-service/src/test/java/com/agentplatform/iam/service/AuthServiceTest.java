package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.UnauthorizedException;
import com.agentplatform.common.security.JwtVerifier;
import com.agentplatform.iam.entity.IamUser;
import com.agentplatform.iam.entity.Membership;
import com.agentplatform.iam.repository.*;
import com.agentplatform.iam.security.JwtIssuer;
import com.agentplatform.iam.security.PasswordHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository               userRepo;
    @Mock private MembershipRepository         membershipRepo;
    @Mock private TenantRepository             tenantRepo;
    @Mock private WorkspaceRepository          workspaceRepo;
    @Mock private WorkspaceMembershipRepository workspaceMembershipRepo;
    @Mock private UserSessionRepository        sessionRepo;
    @Mock private PermissionService            permissionService;
    @Mock private TokenService                 tokenService;
    @Mock private JwtIssuer                    jwtIssuer;
    @Mock private JwtVerifier                  jwtVerifier;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepo, membershipRepo, tenantRepo, workspaceRepo,
                workspaceMembershipRepo, sessionRepo, permissionService,
                tokenService, jwtIssuer, jwtVerifier);
        ReflectionTestUtils.setField(authService, "refreshTokenTtlSeconds", 604800L);
    }

    // ── Signup ───────────────────────────────────────────────────────────────

    @Test
    void signup_createsUserAndReturnsResult() {
        when(userRepo.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepo.save(any())).thenAnswer(inv -> {
            IamUser u = inv.getArgument(0);
            ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
            return u;
        });

        AuthService.SignupResult result = authService.signup("Alice", "alice@example.com", "password123");

        assertThat(result.email()).isEqualTo("alice@example.com");
        assertThat(result.name()).isEqualTo("Alice");
        assertThat(result.userId()).isNotNull();
    }

    @Test
    void signup_throwsConflict_whenEmailAlreadyExists() {
        when(userRepo.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup("Bob", "dup@example.com", "pass"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void signup_savesHashedPassword() {
        when(userRepo.existsByEmail(anyString())).thenReturn(false);
        ArgumentCaptor<IamUser> captor = ArgumentCaptor.forClass(IamUser.class);
        when(userRepo.save(captor.capture())).thenAnswer(inv -> {
            IamUser u = inv.getArgument(0);
            ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
            return u;
        });

        authService.signup("Alice", "alice@example.com", "plaintext");

        IamUser saved = captor.getValue();
        assertThat(saved.getPasswordHash()).isNotEqualTo("plaintext");
        assertThat(PasswordHasher.verify("plaintext", saved.getPasswordHash())).isTrue();
    }

    // ── Login ────────────────────────────────────────────────────────────────

    @Test
    void login_throwsUnauthorized_whenUserNotFound() {
        when(userRepo.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login("nobody@example.com", "pass"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void login_throwsUnauthorized_whenPasswordWrong() {
        IamUser user = activeUser("wrong@example.com", "correct-password");
        when(userRepo.findByEmail("wrong@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login("wrong@example.com", "wrong-password"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void login_throwsUnauthorized_whenUserInactive() {
        IamUser user = activeUser("inactive@example.com", "pass");
        user.setStatus("suspended");
        when(userRepo.findByEmail("inactive@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login("inactive@example.com", "pass"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void login_returnsPreAuthToken_whenUserHasNoMemberships() {
        IamUser user = activeUser("new@example.com", "pass");
        when(userRepo.findByEmail("new@example.com")).thenReturn(Optional.of(user));
        when(membershipRepo.findByUserIdAndStatus(any(), eq("active"))).thenReturn(List.of());
        when(jwtIssuer.issuePreAuthToken(any())).thenReturn("pre-auth-token");

        AuthService.LoginResult result = authService.login("new@example.com", "pass");

        assertThat(result.requireTenantCreation()).isTrue();
        assertThat(result.preAuthToken()).isEqualTo("pre-auth-token");
    }

    @Test
    void login_requiresTenantSelection_whenUserBelongsToMultipleTenants() {
        IamUser user = activeUser("multi@example.com", "pass");
        when(userRepo.findByEmail("multi@example.com")).thenReturn(Optional.of(user));

        Membership m1 = membership(UUID.randomUUID());
        Membership m2 = membership(UUID.randomUUID());
        when(membershipRepo.findByUserIdAndStatus(any(), eq("active"))).thenReturn(List.of(m1, m2));
        when(tenantRepo.findById(any())).thenReturn(Optional.empty());
        when(jwtIssuer.issuePreAuthToken(any())).thenReturn("pre-auth-token");

        AuthService.LoginResult result = authService.login("multi@example.com", "pass");

        assertThat(result.requireTenantSelection()).isTrue();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static IamUser activeUser(String email, String password) {
        IamUser user = new IamUser();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setEmail(email);
        user.setName("Test User");
        user.setPasswordHash(PasswordHasher.hash(password));
        user.setStatus("active");
        return user;
    }

    private static Membership membership(UUID tenantId) {
        Membership m = new Membership();
        ReflectionTestUtils.setField(m, "tenantId", tenantId);
        return m;
    }
}
