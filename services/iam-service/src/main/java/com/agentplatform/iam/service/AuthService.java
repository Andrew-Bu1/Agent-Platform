package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.UnauthorizedException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.security.JwtClaims;
import com.agentplatform.common.security.JwtVerifier;
import com.agentplatform.iam.api.auth.TenantInfo;
import com.agentplatform.iam.api.auth.WorkspaceInfo;
import com.agentplatform.iam.entity.IamUser;
import com.agentplatform.iam.entity.Membership;
import com.agentplatform.iam.entity.UserSession;
import com.agentplatform.iam.entity.Workspace;
import com.agentplatform.iam.entity.WorkspaceMembership;
import com.agentplatform.iam.repository.MembershipRepository;
import com.agentplatform.iam.repository.TenantRepository;
import com.agentplatform.iam.repository.UserRepository;
import com.agentplatform.iam.repository.UserSessionRepository;
import com.agentplatform.iam.repository.WorkspaceMembershipRepository;
import com.agentplatform.iam.repository.WorkspaceRepository;
import com.agentplatform.iam.security.JwtIssuer;
import com.agentplatform.iam.security.PasswordHasher;
import com.nimbusds.jwt.JWTClaimsSet;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository               userRepo;
    private final MembershipRepository         membershipRepo;
    private final TenantRepository             tenantRepo;
    private final WorkspaceRepository          workspaceRepo;
    private final WorkspaceMembershipRepository workspaceMembershipRepo;
    private final UserSessionRepository        sessionRepo;
    private final PermissionService            permissionService;
    private final TokenService                 tokenService;
    private final JwtIssuer                    jwtIssuer;
    private final JwtVerifier                  jwtVerifier;

    @Value("${app.jwt.refresh-token-ttl-seconds:604800}")
    private long refreshTokenTtlSeconds;

    // ── Signup ─────────────────────────────────────────────────────────────────

    public record SignupResult(UUID userId, String email, String name) {}

    @Transactional
    public SignupResult signup(String name, String email, String password) {
        if (userRepo.existsByEmail(email)) {
            throw new ConflictException(ErrorCode.USER_EMAIL_CONFLICT, "Email already registered");
        }

        IamUser user = new IamUser();
        user.setName(name);
        user.setEmail(email);
        user.setPasswordHash(PasswordHasher.hash(password));
        user.setStatus("active");

        userRepo.save(user);
        return new SignupResult(user.getId(), user.getEmail(), user.getName());
    }

    // ── Login ──────────────────────────────────────────────────────────────────

    public record LoginResult(
            String preAuthToken,
            boolean requireTenantCreation,
            boolean requireTenantSelection,
            UUID singleTenantId,       // non-null when requireTenantSelection=false and requireTenantCreation=false
            List<TenantInfo> tenants   // non-null when requireTenantSelection=true
    ) {}

    @Transactional(readOnly = true)
    public LoginResult login(String email, String password) {
        IamUser user = userRepo.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS,
                        "Invalid email or password"));

        if (!"active".equals(user.getStatus())) {
            throw new UnauthorizedException(ErrorCode.USER_INACTIVE, "User account is inactive");
        }

        if (!PasswordHasher.verify(password, user.getPasswordHash())) {
            throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }

        List<Membership> memberships = membershipRepo.findByUserIdAndStatus(user.getId(), "active");
        if (memberships.isEmpty()) {
            // New user with no tenant yet — return a pre_auth token so they can
            // call POST /tenants/bootstrap to create their first tenant + workspace.
            String preAuthToken = jwtIssuer.issuePreAuthToken(user.getId().toString());
            return new LoginResult(preAuthToken, true, false, null, null);
        }

        String preAuthToken = jwtIssuer.issuePreAuthToken(user.getId().toString());

        if (memberships.size() == 1) {
            return new LoginResult(preAuthToken, false, false, memberships.get(0).getTenantId(), null);
        }

        List<UUID> tenantIds = memberships.stream().map(Membership::getTenantId).toList();
        List<TenantInfo> tenantInfos = tenantRepo.findAllById(tenantIds).stream()
                .map(t -> new TenantInfo(t.getId(), t.getCode(), t.getName()))
                .toList();
        return new LoginResult(preAuthToken, false, true, null, tenantInfos);
    }

    // ── List workspaces for a chosen tenant ────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WorkspaceInfo> listWorkspaces(String preAuthToken, UUID tenantId) {
        UUID userId = verifyPreAuth(preAuthToken);

        Membership membership = membershipRepo
                .findByUserIdAndTenantIdAndStatus(userId, tenantId, "active")
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.TENANT_NOT_FOUND,
                        "User has no active membership in the requested tenant"));

        List<WorkspaceMembership> wms =
                workspaceMembershipRepo.findByMembershipIdAndStatus(membership.getId(), "active");

        if (wms.isEmpty()) {
            return List.of();
        }

        List<UUID> workspaceIds = wms.stream().map(WorkspaceMembership::getWorkspaceId).toList();
        return workspaceRepo.findAllById(workspaceIds).stream()
                .filter(w -> "active".equals(w.getStatus()))
                .map(w -> new WorkspaceInfo(w.getId(), w.getCode(), w.getName(), w.getDescription()))
                .toList();
    }

    // ── Switch context (tenant + workspace → full JWT) ─────────────────────────

    public record TokensIssued(String accessToken, String refreshToken,
                                UUID userId, UUID tenantId, UUID workspaceId) {}

    @Transactional
    public TokensIssued switchContext(String preAuthToken, UUID tenantId, UUID workspaceId,
                                      String ipAddress, String userAgent) {
        UUID userId = verifyPreAuth(preAuthToken);

        IamUser user = userRepo.findById(userId)
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.USER_NOT_FOUND, "User not found"));

        // Verify tenant membership
        Membership membership = membershipRepo
                .findByUserIdAndTenantIdAndStatus(userId, tenantId, "active")
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.TENANT_NOT_FOUND,
                        "User has no active membership in the selected tenant"));

        // Verify workspace membership within that tenant
        workspaceMembershipRepo
                .findByMembershipIdAndWorkspaceIdAndStatus(membership.getId(), workspaceId, "active")
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.WORKSPACE_NOT_FOUND,
                        "User does not have access to the selected workspace"));

        return issueTokens(user, tenantId, workspaceId, ipAddress, userAgent);
    }

    // ── Logout ─────────────────────────────────────────────────────────────────

    /** Revoke all sessions for the authenticated user (log out everywhere). */
    @Transactional
    public void logout(AuthContext ctx) {
        sessionRepo.revokeAllForUser(UUID.fromString(ctx.subject()), OffsetDateTime.now());
    }

    /** Revoke only the current session (log out this device only). */
    @Transactional
    public void logoutCurrentSession(AuthContext ctx, String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            logout(ctx);
            return;
        }
        String tokenHash = PasswordHasher.hashToken(rawRefreshToken);
        sessionRepo.findBySessionTokenHashAndRevokedAtIsNullAndExpiresAtAfter(tokenHash, OffsetDateTime.now())
                .ifPresent(s -> {
                    s.setRevokedAt(OffsetDateTime.now());
                    sessionRepo.save(s);
                });
    }

    // ── Change password ────────────────────────────────────────────────────────

    /**
     * Change the authenticated user's password after verifying the current one.
     * All existing sessions are revoked to force re-login on all devices.
     */
    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        IamUser user = userRepo.findById(userId)
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.USER_NOT_FOUND, "User not found"));

        if (!PasswordHasher.verify(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS, "Current password is incorrect");
        }

        user.setPasswordHash(PasswordHasher.hash(newPassword));
        userRepo.save(user);

        // Revoke all sessions — the client must log in again with the new password.
        sessionRepo.revokeAllForUser(userId, OffsetDateTime.now());
    }

    // ── Me ─────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public IamUser me(AuthContext ctx) {
        if (!ctx.isUserToken()) {
            throw new UnauthorizedException(ErrorCode.FORBIDDEN, "Endpoint requires a user token");
        }
        return userRepo.findById(UUID.fromString(ctx.userId()))
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.USER_NOT_FOUND, "User not found"));
    }

    // ── Refresh (token rotation) ───────────────────────────────────────────────

    /**
     * Exchange a valid refresh token for a new access + refresh token pair.
     * The consumed refresh token is revoked immediately (rotation prevents replay).
     *
     * @param rawRefreshToken the refresh token string received from the client
     * @param ipAddress       caller IP for session audit
     * @param userAgent       caller User-Agent for session audit
     */
    @Transactional
    public TokensIssued refresh(String rawRefreshToken, String ipAddress, String userAgent) {
        JWTClaimsSet claims = jwtVerifier.verify(rawRefreshToken);
        String tokenType = (String) claims.getClaim("token_type");
        if (!"refresh".equals(tokenType)) {
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Invalid token type");
        }

        String tokenHash = PasswordHasher.hashToken(rawRefreshToken);
        UserSession session = sessionRepo
                .findBySessionTokenHashAndRevokedAtIsNullAndExpiresAtAfter(tokenHash, OffsetDateTime.now())
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.TOKEN_INVALID,
                        "Refresh token not recognized or already revoked"));

        IamUser user = userRepo.findById(session.getUserId())
                .orElseThrow(() -> new UnauthorizedException(ErrorCode.USER_NOT_FOUND, "User not found"));

        if (!"active".equals(user.getStatus())) {
            throw new UnauthorizedException(ErrorCode.USER_INACTIVE, "User account is inactive");
        }

        // Revoke the consumed token before issuing a new one.
        session.setRevokedAt(OffsetDateTime.now());
        sessionRepo.save(session);

        return issueTokens(user, session.getTenantId(), session.getWorkspaceId(), ipAddress, userAgent);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private UUID verifyPreAuth(String preAuthToken) {
        JWTClaimsSet claims = jwtVerifier.verify(preAuthToken);
        String tokenType = (String) claims.getClaim("token_type");
        if (!"pre_auth".equals(tokenType)) {
            throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, "Invalid token type");
        }
        return UUID.fromString(claims.getSubject());
    }

    /**
     * Public variant used by {@code TenantController} during the bootstrap flow to
     * extract the user ID from a pre_auth token without issuing any new tokens.
     */
    public UUID resolvePreAuthUserId(String preAuthToken) {
        return verifyPreAuth(preAuthToken);
    }

    private TokensIssued issueTokens(IamUser user, UUID tenantId, UUID workspaceId,
                                     String ipAddress, String userAgent) {
        List<String> permissions = permissionService.collectUserPermissions(
                user.getId(), tenantId, workspaceId);

        JwtClaims jwtClaims = tokenService.buildUserTokenClaims(user, tenantId, workspaceId, permissions);
        String accessToken  = jwtIssuer.issueAccessToken(jwtClaims);
        String refreshToken = jwtIssuer.issueRefreshToken(user.getId().toString());

        persistSession(user.getId(), tenantId, workspaceId, refreshToken, ipAddress, userAgent);

        user.setLastLoginAt(OffsetDateTime.now());
        userRepo.save(user);

        return new TokensIssued(accessToken, refreshToken, user.getId(), tenantId, workspaceId);
    }

    private void persistSession(UUID userId, UUID tenantId, UUID workspaceId,
                                 String refreshToken, String ipAddress, String userAgent) {
        OffsetDateTime now = OffsetDateTime.now();
        UserSession session = new UserSession();
        session.setId(UUID.randomUUID());
        session.setUserId(userId);
        session.setTenantId(tenantId);
        session.setWorkspaceId(workspaceId);
        session.setSessionTokenHash(PasswordHasher.hashToken(refreshToken));
        session.setAuthMethod("password");
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setExpiresAt(now.plusSeconds(refreshTokenTtlSeconds));
        session.setLastUsedAt(now);
        session.setCreatedAt(now);
        sessionRepo.save(session);
    }
}
