package com.agentplatform.access.service;

import com.agentplatform.access.dto.AuthResponse;
import com.agentplatform.access.dto.LoginRequest;
import com.agentplatform.access.dto.LogoutRequest;
import com.agentplatform.access.dto.RefreshTokenRequest;
import com.agentplatform.access.dto.SignupRequest;
import com.agentplatform.access.dto.SwitchTenantRequest;
import com.agentplatform.access.entity.Membership;
import com.agentplatform.access.entity.Tenant;
import com.agentplatform.access.entity.User;
import com.agentplatform.access.entity.UserSession;
import com.agentplatform.exception.AppException;
import com.agentplatform.access.repository.MembershipRepository;
import com.agentplatform.access.repository.TenantRepository;
import com.agentplatform.access.repository.UserRepository;
import com.agentplatform.access.repository.UserSessionRepository;
import com.agentplatform.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final MembershipRepository membershipRepository;
    private final UserSessionRepository userSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditLogService auditLogService;

    @Value("${app.jwt.refresh-token-expiry-days:30}")
    private long refreshTokenExpiryDays;

    @Transactional
    public AuthResponse signup(SignupRequest req, String userAgent, String ipAddress) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new AppException(HttpStatus.CONFLICT, "Email is already registered");
        }

        User user = User.builder()
                .id(UUID.randomUUID())
                .email(req.getEmail().toLowerCase())
                .name(req.getName())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .status("active")
                .build();
        userRepository.save(user);

        String tenantCode = generateTenantCode(req.getTenantName());
        Tenant tenant = Tenant.builder()
                .id(UUID.randomUUID())
                .name(req.getTenantName())
                .code(tenantCode)
                .status("active")
                .planKey("basic")
                .build();
        tenantRepository.save(tenant);

        Membership membership = Membership.builder()
                .id(UUID.randomUUID())
                .user(user)
                .tenant(tenant)
                .status("active")
                .joinedAt(OffsetDateTime.now())
                .build();
        membershipRepository.save(membership);

        AuthResponse response = createSession(user, tenant, "password", userAgent, ipAddress);

        // Defer audit log until after this transaction commits so that the newly
        // created tenant row is visible to the REQUIRES_NEW audit log transaction.
        UUID userId = user.getId();
        UUID tenantId = tenant.getId();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                auditLogService.log("user", userId.toString(), tenantId,
                        "user:signup", "user", userId.toString());
            }
        });

        return response;
    }

    @Transactional
    public AuthResponse login(LoginRequest req, String userAgent, String ipAddress) {
        User user = userRepository.findByEmail(req.getEmail().toLowerCase())
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!"active".equals(user.getStatus())) {
            throw new AppException(HttpStatus.FORBIDDEN, "Account is disabled");
        }

        if (user.getPasswordHash() == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            auditLogService.log("user", req.getEmail(), null,
                    "user:login", "user", user.getId().toString(), "deny", "Invalid password");
            throw new AppException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        List<Membership> memberships = membershipRepository.findByUserAndStatus(user, "active");
        if (memberships.isEmpty()) {
            throw new AppException(HttpStatus.FORBIDDEN, "No active tenant membership found");
        }

        // Phase 1: use first active tenant
        Tenant tenant = memberships.get(0).getTenant();

        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        AuthResponse response = createSession(user, tenant, "password", userAgent, ipAddress);
        auditLogService.log("user", user.getId().toString(), tenant.getId(),
                "user:login", "user_session", null);
        return response;
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest req, String userAgent, String ipAddress) {
        String hash = hashToken(req.getRefreshToken());
        UserSession session = userSessionRepository.findByRefreshTokenHash(hash)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token"));

        if (session.getRevokedAt() != null) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Session has been revoked");
        }

        if (session.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Refresh token has expired");
        }

        // Rotate: revoke the old session and issue a new one
        session.setRevokedAt(OffsetDateTime.now());
        userSessionRepository.save(session);

        User user = session.getUser();
        Tenant tenant = session.getTenant();

        AuthResponse response = createSession(user, tenant, session.getAuthMethod(), userAgent, ipAddress);
        auditLogService.log("user", user.getId().toString(), tenant.getId(),
                "user:token_refresh", "user_session", null);
        return response;
    }

    @Transactional
    public AuthResponse switchTenant(UUID userId, SwitchTenantRequest req, String userAgent, String ipAddress) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        Tenant tenant = tenantRepository.findById(req.getTenantId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Tenant not found"));

        membershipRepository.findByUserAndTenant(user, tenant)
                .filter(m -> "active".equals(m.getStatus()))
                .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "No active membership for the requested tenant"));

        AuthResponse response = createSession(user, tenant, "switch", userAgent, ipAddress);
        auditLogService.log("user", userId.toString(), tenant.getId(),
                "user:switch_tenant", "user_session", null);
        return response;
    }

    @Transactional
    public void logout(LogoutRequest req) {
        String hash = hashToken(req.getRefreshToken());
        UserSession session = userSessionRepository.findByRefreshTokenHash(hash)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "Invalid or expired refresh token"));

        if (session.getRevokedAt() != null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Session already revoked");
        }

        session.setRevokedAt(OffsetDateTime.now());
        userSessionRepository.save(session);
        auditLogService.log("user", session.getUser().getId().toString(), session.getTenant().getId(),
                "user:logout", "user_session", session.getId().toString());
    }

    // ---- private helpers ----

    private AuthResponse createSession(User user, Tenant tenant, String authMethod,
                                       String userAgent, String ipAddress) {
        String rawRefreshToken = generateRefreshToken();
        String refreshTokenHash = hashToken(rawRefreshToken);

        UserSession session = UserSession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .tenant(tenant)
                .refreshTokenHash(refreshTokenHash)
                .authMethod(authMethod)
                .userAgent(userAgent)
                .ipAddress(ipAddress)
                .expiresAt(OffsetDateTime.now().plusDays(refreshTokenExpiryDays))
                .build();
        userSessionRepository.save(session);

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), tenant.getId());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getAccessTokenExpirySeconds())
                .build();
    }

    private String generateTenantCode(String tenantName) {
        String base = tenantName.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (base.length() > 80) {
            base = base.substring(0, 80);
        }
        String code = base;
        int suffix = 1;
        while (tenantRepository.existsByCode(code)) {
            code = base + "-" + suffix++;
        }
        return code;
    }

    private String generateRefreshToken() {
        byte[] bytes = new byte[48];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
