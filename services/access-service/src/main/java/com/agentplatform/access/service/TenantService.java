package com.agentplatform.access.service;

import com.agentplatform.access.dto.AddMemberRequest;
import com.agentplatform.access.dto.CreateTenantRequest;
import com.agentplatform.access.dto.MembershipResponse;
import com.agentplatform.access.dto.TenantResponse;
import com.agentplatform.access.dto.UpdateTenantRequest;
import com.agentplatform.access.entity.Membership;
import com.agentplatform.access.entity.Tenant;
import com.agentplatform.access.entity.User;
import com.agentplatform.exception.AppException;
import com.agentplatform.access.repository.MembershipRepository;
import com.agentplatform.access.repository.TenantRepository;
import com.agentplatform.access.repository.UserRepository;
import com.agentplatform.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final MembershipRepository membershipRepository;
    private final AuditLogService auditLogService;

    public Page<TenantResponse> listTenants(String search, Pageable pageable) {
        if (search == null || search.isBlank()) {
            return tenantRepository.findAll(pageable).map(TenantResponse::from);
        }
        return tenantRepository.search(search, pageable).map(TenantResponse::from);
    }

    public TenantResponse getTenant(UUID id) {
        return TenantResponse.from(findOrThrow(id));
    }

    @Transactional
    public TenantResponse createTenant(CreateTenantRequest req) {
        String code = StringUtils.hasText(req.getCode())
                ? req.getCode()
                : generateCode(req.getName());

        if (tenantRepository.existsByCode(code)) {
            throw new AppException(HttpStatus.CONFLICT, "Tenant code '" + code + "' is already taken");
        }

        Tenant tenant = Tenant.builder()
                .id(UUID.randomUUID())
                .name(req.getName())
                .code(code)
                .status("active")
                .planKey(req.getPlanKey() != null ? req.getPlanKey() : "basic")
                .build();
        Tenant saved = tenantRepository.save(tenant);
        auditLogService.log("user", actorId(), saved.getId(), "tenant:create", "tenant", saved.getId().toString());
        return TenantResponse.from(saved);
    }

    @Transactional
    public TenantResponse updateTenant(UUID id, UpdateTenantRequest req) {
        Tenant tenant = findOrThrow(id);
        if (req.getName() != null) tenant.setName(req.getName());
        if (req.getStatus() != null) tenant.setStatus(req.getStatus());
        if (req.getPlanKey() != null) tenant.setPlanKey(req.getPlanKey());
        if (req.getSettings() != null) tenant.setSettings(req.getSettings());
        Tenant saved = tenantRepository.save(tenant);
        auditLogService.log("user", actorId(), id, "tenant:update", "tenant", id.toString());
        return TenantResponse.from(saved);
    }

    @Transactional
    public void deleteTenant(UUID id) {
        if (!tenantRepository.existsById(id)) {
            throw new AppException(HttpStatus.NOT_FOUND, "Tenant not found");
        }
        tenantRepository.deleteById(id);
        auditLogService.log("user", actorId(), id, "tenant:delete", "tenant", id.toString());
    }

    public List<MembershipResponse> getTenantMembers(UUID id) {
        Tenant tenant = findOrThrow(id);
        return membershipRepository.findByTenant(tenant).stream()
                .map(MembershipResponse::from)
                .toList();
    }

    @Transactional
    public MembershipResponse addMember(UUID tenantId, AddMemberRequest req) {
        Tenant tenant = findOrThrow(tenantId);
        User user = userRepository.findById(req.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (membershipRepository.existsByUserAndTenant(user, tenant)) {
            throw new AppException(HttpStatus.CONFLICT, "User is already a member of this tenant");
        }

        Membership membership = Membership.builder()
                .id(UUID.randomUUID())
                .user(user)
                .tenant(tenant)
                .status(req.getStatus())
                .joinedAt(OffsetDateTime.now())
                .build();
        MembershipResponse result = MembershipResponse.from(membershipRepository.save(membership));
        auditLogService.log("user", actorId(), tenantId, "membership:add", "membership", membership.getId().toString());
        return result;
    }

    @Transactional
    public void removeMember(UUID tenantId, UUID userId) {
        Tenant tenant = findOrThrow(tenantId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        Membership membership = membershipRepository.findByUserAndTenant(user, tenant)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Membership not found"));

        membershipRepository.delete(membership);
        auditLogService.log("user", actorId(), tenantId, "membership:remove", "membership", membership.getId().toString());
    }

    private Tenant findOrThrow(UUID id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Tenant not found"));
    }

    private String actorId() {
        try {
            return SecurityUtils.currentUserId().toString();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private String generateCode(String name) {
        return name.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
    }
}
