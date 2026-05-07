package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.iam.entity.Membership;
import com.agentplatform.iam.entity.MembershipRole;
import com.agentplatform.iam.entity.MembershipRoleId;
import com.agentplatform.iam.entity.Role;
import com.agentplatform.iam.entity.Tenant;
import com.agentplatform.iam.entity.Workspace;
import com.agentplatform.iam.entity.WorkspaceMembership;
import com.agentplatform.iam.entity.WorkspaceMembershipRole;
import com.agentplatform.iam.entity.WorkspaceMembershipRoleId;
import com.agentplatform.iam.repository.MembershipRepository;
import com.agentplatform.iam.repository.MembershipRoleRepository;
import com.agentplatform.iam.repository.RoleRepository;
import com.agentplatform.iam.repository.TenantRepository;
import com.agentplatform.iam.repository.WorkspaceMembershipRepository;
import com.agentplatform.iam.repository.WorkspaceMembershipRoleRepository;
import com.agentplatform.iam.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository                 tenantRepo;
    private final WorkspaceRepository              workspaceRepo;
    private final MembershipRepository             membershipRepo;
    private final WorkspaceMembershipRepository    workspaceMembershipRepo;
    private final MembershipRoleRepository         membershipRoleRepo;
    private final WorkspaceMembershipRoleRepository workspaceMembershipRoleRepo;
    private final RoleRepository                   roleRepo;

    // ── Read ──────────────────────────────────────────────────────────────────

    /** List all active tenants the user is a member of. */
    @Transactional(readOnly = true)
    public List<Tenant> listUserTenants(UUID userId) {
        List<UUID> tenantIds = membershipRepo.findByUserIdAndStatus(userId, "active").stream()
                .map(Membership::getTenantId)
                .toList();
        return tenantRepo.findAllById(tenantIds).stream()
                .filter(t -> "active".equals(t.getStatus()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Tenant getTenant(UUID userId, UUID tenantId) {
        requireActiveMembership(userId, tenantId);
        return tenantRepo.findByIdAndStatus(tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.TENANT_NOT_FOUND, "Tenant not found"));
    }

    /** List active workspaces in a tenant, verifying the user is a member. */
    @Transactional(readOnly = true)
    public List<Workspace> listTenantWorkspaces(UUID userId, UUID tenantId) {
        requireActiveMembership(userId, tenantId);
        return workspaceRepo.findByTenantIdAndStatus(tenantId, "active");
    }

    @Transactional(readOnly = true)
    public Workspace getWorkspace(UUID userId, UUID tenantId, UUID workspaceId) {
        requireActiveMembership(userId, tenantId);
        return workspaceRepo.findByIdAndTenantId(workspaceId, tenantId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
    }

    // ── Tenant CRUD ───────────────────────────────────────────────────────────

    /**
     * Create a new tenant with a default workspace and enrol {@code userId} as owner.
     * Assigns {@code tenant_admin} to the tenant membership and {@code workspace_owner}
     * to the workspace membership so the creator has full permissions from the start.
     */
    @Transactional
    public TenantCreated createTenant(UUID userId, String tenantCode, String tenantName,
                                      String workspaceCode, String workspaceName) {
        if (tenantRepo.existsByCode(tenantCode)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Tenant code '" + tenantCode + "' is already taken");
        }

        Tenant tenant = new Tenant();
        tenant.setCode(tenantCode);
        tenant.setName(tenantName);
        tenant.setStatus("active");
        tenantRepo.save(tenant);

        Membership membership = new Membership();
        membership.setTenantId(tenant.getId());
        membership.setUserId(userId);
        membership.setStatus("active");
        membership.setJoinedAt(OffsetDateTime.now());
        membershipRepo.save(membership);

        // Assign tenant_admin role so the creator has full tenant-level permissions.
        assignRoleToMembership(membership.getId(), "tenant_admin");

        Workspace workspace = createWorkspaceInternal(userId, tenant.getId(), workspaceCode, workspaceName, null);
        WorkspaceMembership wm = createWorkspaceMembershipInternal(tenant.getId(), workspace.getId(), membership.getId());

        // Assign workspace_owner so the creator has full workspace-level permissions.
        assignRoleToWorkspaceMembership(wm.getId(), "workspace_owner");

        return new TenantCreated(tenant, workspace);
    }

    /** Update a tenant's name. User must be a tenant_admin. */
    @Transactional
    public Tenant updateTenant(UUID userId, UUID tenantId, String name) {
        requireTenantAdmin(userId, tenantId);
        Tenant tenant = tenantRepo.findByIdAndStatus(tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.TENANT_NOT_FOUND, "Tenant not found"));
        tenant.setName(name);
        return tenantRepo.save(tenant);
    }

    /** Soft-delete a tenant (status → inactive). User must be a tenant_admin. */
    @Transactional
    public void deactivateTenant(UUID userId, UUID tenantId) {
        requireTenantAdmin(userId, tenantId);
        Tenant tenant = tenantRepo.findByIdAndStatus(tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.TENANT_NOT_FOUND, "Tenant not found"));
        tenant.setStatus("inactive");
        tenantRepo.save(tenant);
    }

    // ── Workspace CRUD ────────────────────────────────────────────────────────

    /**
     * Create a workspace inside a tenant.
     * Automatically adds the creating user as a member with {@code workspace_owner}.
     */
    @Transactional
    public Workspace createWorkspace(UUID userId, UUID tenantId,
                                     String code, String name, String description) {
        Membership membership = requireActiveMembership(userId, tenantId);
        Workspace ws = createWorkspaceInternal(userId, tenantId, code, name, description);
        WorkspaceMembership wm = createWorkspaceMembershipInternal(tenantId, ws.getId(), membership.getId());
        assignRoleToWorkspaceMembership(wm.getId(), "workspace_owner");
        return ws;
    }

    /** Update a workspace's name and description. User must be a tenant_admin. */
    @Transactional
    public Workspace updateWorkspace(UUID userId, UUID tenantId, UUID workspaceId,
                                     String name, String description) {
        requireTenantAdmin(userId, tenantId);
        Workspace ws = workspaceRepo.findByIdAndTenantId(workspaceId, tenantId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
        ws.setName(name);
        if (description != null) ws.setDescription(description);
        return workspaceRepo.save(ws);
    }

    /** Soft-delete a workspace (status → inactive). User must be a tenant_admin. */
    @Transactional
    public void deactivateWorkspace(UUID userId, UUID tenantId, UUID workspaceId) {
        requireTenantAdmin(userId, tenantId);
        Workspace ws = workspaceRepo.findByIdAndTenantId(workspaceId, tenantId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
        ws.setStatus("inactive");
        workspaceRepo.save(ws);
    }

    // ── Return types ──────────────────────────────────────────────────────────

    public record TenantCreated(Tenant tenant, Workspace workspace) {}

    // ── Package-accessible helpers (used by MemberService) ───────────────────

    Membership requireActiveMembership(UUID userId, UUID tenantId) {
        return membershipRepo.findByUserIdAndTenantIdAndStatus(userId, tenantId, "active")
                .orElseThrow(() -> new ForbiddenException(ErrorCode.FORBIDDEN,
                        "User is not a member of this tenant"));
    }

    void requireTenantAdmin(UUID userId, UUID tenantId) {
        Membership membership = requireActiveMembership(userId, tenantId);
        List<MembershipRole> assigned = membershipRoleRepo.findByIdMembershipId(membership.getId());
        List<UUID> roleIds = assigned.stream().map(mr -> mr.getId().getRoleId()).toList();
        boolean isAdmin = roleRepo.findByIdIn(roleIds).stream()
                .anyMatch(r -> "tenant_admin".equals(r.getKey()));
        if (!isAdmin) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "tenant_admin role required");
        }
    }

    WorkspaceMembership createWorkspaceMembershipInternal(UUID tenantId, UUID workspaceId, UUID membershipId) {
        // Idempotent — skip if already a member.
        return workspaceMembershipRepo
                .findByMembershipIdAndWorkspaceId(membershipId, workspaceId)
                .orElseGet(() -> {
                    WorkspaceMembership wm = new WorkspaceMembership();
                    wm.setTenantId(tenantId);
                    wm.setWorkspaceId(workspaceId);
                    wm.setMembershipId(membershipId);
                    wm.setStatus("active");
                    wm.setJoinedAt(OffsetDateTime.now());
                    return workspaceMembershipRepo.save(wm);
                });
    }

    void assignRoleToMembership(UUID membershipId, String roleKey) {
        Role role = roleRepo.findByKey(roleKey)
                .orElseThrow(() -> new NotFoundException(ErrorCode.ROLE_NOT_FOUND,
                        "System role '" + roleKey + "' not found — is the DB seeded?"));
        MembershipRoleId pk = new MembershipRoleId(membershipId, role.getId());
        if (!membershipRoleRepo.existsById(pk)) {
            MembershipRole mr = new MembershipRole();
            mr.setId(pk);
            membershipRoleRepo.save(mr);
        }
    }

    void assignRoleToWorkspaceMembership(UUID workspaceMembershipId, String roleKey) {
        Role role = roleRepo.findByKey(roleKey)
                .orElseThrow(() -> new NotFoundException(ErrorCode.ROLE_NOT_FOUND,
                        "System role '" + roleKey + "' not found — is the DB seeded?"));
        WorkspaceMembershipRoleId pk = new WorkspaceMembershipRoleId(workspaceMembershipId, role.getId());
        if (!workspaceMembershipRoleRepo.existsById(pk)) {
            WorkspaceMembershipRole wmr = new WorkspaceMembershipRole();
            wmr.setId(pk);
            workspaceMembershipRoleRepo.save(wmr);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Workspace createWorkspaceInternal(UUID userId, UUID tenantId,
                                              String code, String name, String description) {
        if (workspaceRepo.existsByTenantIdAndCode(tenantId, code)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Workspace code '" + code + "' already exists in this tenant");
        }
        Workspace ws = new Workspace();
        ws.setTenantId(tenantId);
        ws.setCode(code);
        ws.setName(name);
        ws.setDescription(description);
        ws.setStatus("active");
        ws.setCreatedByUserId(userId);
        return workspaceRepo.save(ws);
    }
}
