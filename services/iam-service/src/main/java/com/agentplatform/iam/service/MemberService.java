package com.agentplatform.iam.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ErrorCode;
import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.iam.entity.IamUser;
import com.agentplatform.iam.entity.Membership;
import com.agentplatform.iam.entity.MembershipRole;
import com.agentplatform.iam.entity.MembershipRoleId;
import com.agentplatform.iam.entity.Role;
import com.agentplatform.iam.entity.WorkspaceMembership;
import com.agentplatform.iam.entity.WorkspaceMembershipRole;
import com.agentplatform.iam.entity.WorkspaceMembershipRoleId;
import com.agentplatform.iam.repository.MembershipRepository;
import com.agentplatform.iam.repository.MembershipRoleRepository;
import com.agentplatform.iam.repository.RoleRepository;
import com.agentplatform.iam.repository.UserRepository;
import com.agentplatform.iam.repository.UserSessionRepository;
import com.agentplatform.iam.repository.WorkspaceMembershipRepository;
import com.agentplatform.iam.repository.WorkspaceMembershipRoleRepository;
import com.agentplatform.iam.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MembershipRepository              membershipRepo;
    private final MembershipRoleRepository          membershipRoleRepo;
    private final WorkspaceMembershipRepository     workspaceMembershipRepo;
    private final WorkspaceMembershipRoleRepository workspaceMembershipRoleRepo;
    private final RoleRepository                    roleRepo;
    private final UserRepository                    userRepo;
    private final WorkspaceRepository               workspaceRepo;
    private final UserSessionRepository             sessionRepo;
    private final TenantService                     tenantService;

    // ── Tenant members ────────────────────────────────────────────────────────

    /** List all active members of a tenant with their assigned roles. */
    @Transactional(readOnly = true)
    public List<TenantMemberDto> listTenantMembers(UUID requesterId, UUID tenantId) {
        tenantService.requireActiveMembership(requesterId, tenantId);

        List<Membership> memberships = membershipRepo.findByTenantIdAndStatus(tenantId, "active");
        List<UUID> membershipIds = memberships.stream().map(Membership::getId).toList();
        List<UUID> userIds = memberships.stream().map(Membership::getUserId).toList();

        // Batch load users and roles.
        Map<UUID, IamUser> usersById = userRepo.findAllById(userIds).stream()
                .collect(Collectors.toMap(IamUser::getId, u -> u));

        List<MembershipRole> roleAssignments = membershipRoleRepo.findByIdMembershipIdIn(membershipIds);
        List<UUID> roleIds = roleAssignments.stream().map(mr -> mr.getId().getRoleId()).distinct().toList();
        Map<UUID, String> roleKeyById = roleRepo.findByIdIn(roleIds).stream()
                .collect(Collectors.toMap(Role::getId, Role::getKey));

        // Group role keys per membership.
        Map<UUID, List<String>> rolesByMembershipId = roleAssignments.stream()
                .collect(Collectors.groupingBy(
                        mr -> mr.getId().getMembershipId(),
                        Collectors.mapping(mr -> roleKeyById.getOrDefault(mr.getId().getRoleId(), "unknown"),
                                Collectors.toList())));

        return memberships.stream().map(m -> {
            IamUser user = usersById.get(m.getUserId());
            return new TenantMemberDto(
                    m.getId(),
                    m.getUserId(),
                    user != null ? user.getEmail() : null,
                    user != null ? user.getName() : null,
                    m.getJoinedAt(),
                    rolesByMembershipId.getOrDefault(m.getId(), List.of()));
        }).toList();
    }

    /**
     * Invite a user (by email) to a tenant.
     * If the user does not exist, throws NOT_FOUND — they must sign up first.
     */
    @Transactional
    public TenantMemberDto inviteToTenant(UUID inviterId, UUID tenantId,
                                          String targetEmail, String roleKey) {
        tenantService.requireTenantAdmin(inviterId, tenantId);

        IamUser target = userRepo.findByEmail(targetEmail)
                .orElseThrow(() -> new NotFoundException(ErrorCode.USER_NOT_FOUND,
                        "No user found with email: " + targetEmail));

        if (membershipRepo.findByUserIdAndTenantIdAndStatus(target.getId(), tenantId, "active").isPresent()) {
            throw new ConflictException(ErrorCode.CONFLICT, "User is already a member of this tenant");
        }

        Role role = requireRole(tenantId, roleKey, "tenant");

        Membership membership = new Membership();
        membership.setTenantId(tenantId);
        membership.setUserId(target.getId());
        membership.setStatus("active");
        membership.setJoinedAt(OffsetDateTime.now());
        membershipRepo.save(membership);

        MembershipRole mr = new MembershipRole();
        mr.setId(new MembershipRoleId(membership.getId(), role.getId()));
        membershipRoleRepo.save(mr);

        return new TenantMemberDto(membership.getId(), target.getId(),
                target.getEmail(), target.getName(), membership.getJoinedAt(), List.of(role.getKey()));
    }

    /** Remove a user from a tenant (soft-deactivate their membership). */
    @Transactional
    public void removeFromTenant(UUID removerId, UUID tenantId, UUID targetUserId) {
        tenantService.requireTenantAdmin(removerId, tenantId);

        Membership membership = membershipRepo.findByUserIdAndTenantIdAndStatus(targetUserId, tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this tenant"));

        // Deactivate all workspace memberships for this tenant membership.
        workspaceMembershipRepo.findByMembershipId(membership.getId())
                .forEach(wm -> {
                    workspaceMembershipRoleRepo.deleteAllByWorkspaceMembershipId(wm.getId());
                    wm.setStatus("inactive");
                    workspaceMembershipRepo.save(wm);
                });

        membershipRoleRepo.deleteAllByMembershipId(membership.getId());
        membership.setStatus("inactive");
        membershipRepo.save(membership);

        // Revoke only sessions for this tenant — the user may have active sessions in other tenants.
        sessionRepo.revokeAllForUserAndTenant(targetUserId, tenantId, OffsetDateTime.now());
    }

    // ── Tenant role management ────────────────────────────────────────────────

    @Transactional
    public void assignTenantRole(UUID assignerId, UUID tenantId,
                                 UUID targetUserId, String roleKey) {
        tenantService.requireTenantAdmin(assignerId, tenantId);

        Membership membership = membershipRepo.findByUserIdAndTenantIdAndStatus(targetUserId, tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this tenant"));

        Role role = requireRole(tenantId, roleKey, "tenant");

        MembershipRoleId pk = new MembershipRoleId(membership.getId(), role.getId());
        if (membershipRoleRepo.existsById(pk)) {
            throw new ConflictException(ErrorCode.CONFLICT, "Role already assigned");
        }
        MembershipRole mr = new MembershipRole();
        mr.setId(pk);
        membershipRoleRepo.save(mr);
    }

    @Transactional
    public void revokeTenantRole(UUID revokerId, UUID tenantId,
                                 UUID targetUserId, String roleKey) {
        tenantService.requireTenantAdmin(revokerId, tenantId);

        Membership membership = membershipRepo.findByUserIdAndTenantIdAndStatus(targetUserId, tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this tenant"));

        Role role = requireRole(tenantId, roleKey, "tenant");

        MembershipRoleId pk = new MembershipRoleId(membership.getId(), role.getId());
        if (!membershipRoleRepo.existsById(pk)) {
            throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND, "Role not assigned to this member");
        }
        membershipRoleRepo.deleteById(pk);
    }

    // ── Workspace members ─────────────────────────────────────────────────────

    /** List all active members of a workspace with their assigned roles. */
    @Transactional(readOnly = true)
    public List<WorkspaceMemberDto> listWorkspaceMembers(UUID requesterId, UUID tenantId, UUID workspaceId) {
        tenantService.requireActiveMembership(requesterId, tenantId);
        requireWorkspaceInTenant(workspaceId, tenantId);

        List<WorkspaceMembership> wms = workspaceMembershipRepo.findByWorkspaceIdAndStatus(workspaceId, "active");
        List<UUID> wmIds = wms.stream().map(WorkspaceMembership::getId).toList();
        List<UUID> membershipIds = wms.stream().map(WorkspaceMembership::getMembershipId).toList();

        // Load underlying memberships to get userIds.
        Map<UUID, UUID> userIdByMembershipId = membershipRepo.findAllById(membershipIds).stream()
                .collect(Collectors.toMap(Membership::getId, Membership::getUserId));

        List<UUID> userIds = userIdByMembershipId.values().stream().distinct().toList();
        Map<UUID, IamUser> usersById = userRepo.findAllById(userIds).stream()
                .collect(Collectors.toMap(IamUser::getId, u -> u));

        // Batch load roles.
        List<WorkspaceMembershipRole> roleAssignments = workspaceMembershipRoleRepo.findByIdWorkspaceMembershipIdIn(wmIds);
        List<UUID> roleIds = roleAssignments.stream().map(r -> r.getId().getRoleId()).distinct().toList();
        Map<UUID, String> roleKeyById = roleRepo.findByIdIn(roleIds).stream()
                .collect(Collectors.toMap(Role::getId, Role::getKey));

        Map<UUID, List<String>> rolesByWmId = roleAssignments.stream()
                .collect(Collectors.groupingBy(
                        r -> r.getId().getWorkspaceMembershipId(),
                        Collectors.mapping(r -> roleKeyById.getOrDefault(r.getId().getRoleId(), "unknown"),
                                Collectors.toList())));

        return wms.stream().map(wm -> {
            UUID userId = userIdByMembershipId.get(wm.getMembershipId());
            IamUser user = usersById.get(userId);
            return new WorkspaceMemberDto(
                    wm.getId(),
                    userId,
                    user != null ? user.getEmail() : null,
                    user != null ? user.getName() : null,
                    wm.getJoinedAt(),
                    rolesByWmId.getOrDefault(wm.getId(), List.of()));
        }).toList();
    }

    /**
     * Invite an existing tenant member (by email) to a workspace.
     * The user must already be a tenant member — invite them to the tenant first.
     */
    @Transactional
    public WorkspaceMemberDto inviteToWorkspace(UUID inviterId, UUID tenantId, UUID workspaceId,
                                                String targetEmail, String roleKey) {
        tenantService.requireTenantAdmin(inviterId, tenantId);
        requireWorkspaceInTenant(workspaceId, tenantId);

        IamUser target = userRepo.findByEmail(targetEmail)
                .orElseThrow(() -> new NotFoundException(ErrorCode.USER_NOT_FOUND,
                        "No user found with email: " + targetEmail));

        Membership membership = membershipRepo.findByUserIdAndTenantIdAndStatus(target.getId(), tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "User must be a tenant member before being added to a workspace"));

        if (workspaceMembershipRepo.findByMembershipIdAndWorkspaceIdAndStatus(
                membership.getId(), workspaceId, "active").isPresent()) {
            throw new ConflictException(ErrorCode.CONFLICT, "User is already a member of this workspace");
        }

        Role role = requireRole(tenantId, roleKey, "workspace");

        WorkspaceMembership wm = tenantService.createWorkspaceMembershipInternal(
                tenantId, workspaceId, membership.getId());

        WorkspaceMembershipRole wmr = new WorkspaceMembershipRole();
        wmr.setId(new WorkspaceMembershipRoleId(wm.getId(), role.getId()));
        workspaceMembershipRoleRepo.save(wmr);

        return new WorkspaceMemberDto(wm.getId(), target.getId(),
                target.getEmail(), target.getName(), wm.getJoinedAt(), List.of(role.getKey()));
    }

    /** Remove a user from a workspace (soft-deactivate their workspace membership). */
    @Transactional
    public void removeFromWorkspace(UUID removerId, UUID tenantId, UUID workspaceId, UUID targetUserId) {
        tenantService.requireTenantAdmin(removerId, tenantId);
        requireWorkspaceInTenant(workspaceId, tenantId);

        Membership membership = membershipRepo.findByUserIdAndTenantIdAndStatus(targetUserId, tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this tenant"));

        WorkspaceMembership wm = workspaceMembershipRepo
                .findByMembershipIdAndWorkspaceIdAndStatus(membership.getId(), workspaceId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this workspace"));

        workspaceMembershipRoleRepo.deleteAllByWorkspaceMembershipId(wm.getId());
        wm.setStatus("inactive");
        workspaceMembershipRepo.save(wm);
    }

    // ── Workspace role management ─────────────────────────────────────────────

    @Transactional
    public void assignWorkspaceRole(UUID assignerId, UUID tenantId, UUID workspaceId,
                                    UUID targetUserId, String roleKey) {
        tenantService.requireTenantAdmin(assignerId, tenantId);
        requireWorkspaceInTenant(workspaceId, tenantId);

        Membership membership = membershipRepo.findByUserIdAndTenantIdAndStatus(targetUserId, tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this tenant"));

        WorkspaceMembership wm = workspaceMembershipRepo
                .findByMembershipIdAndWorkspaceIdAndStatus(membership.getId(), workspaceId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this workspace"));

        Role role = requireRole(tenantId, roleKey, "workspace");

        WorkspaceMembershipRoleId pk = new WorkspaceMembershipRoleId(wm.getId(), role.getId());
        if (workspaceMembershipRoleRepo.existsById(pk)) {
            throw new ConflictException(ErrorCode.CONFLICT, "Role already assigned");
        }
        WorkspaceMembershipRole wmr = new WorkspaceMembershipRole();
        wmr.setId(pk);
        workspaceMembershipRoleRepo.save(wmr);
    }

    @Transactional
    public void revokeWorkspaceRole(UUID revokerId, UUID tenantId, UUID workspaceId,
                                    UUID targetUserId, String roleKey) {
        tenantService.requireTenantAdmin(revokerId, tenantId);
        requireWorkspaceInTenant(workspaceId, tenantId);

        Membership membership = membershipRepo.findByUserIdAndTenantIdAndStatus(targetUserId, tenantId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this tenant"));

        WorkspaceMembership wm = workspaceMembershipRepo
                .findByMembershipIdAndWorkspaceIdAndStatus(membership.getId(), workspaceId, "active")
                .orElseThrow(() -> new NotFoundException(ErrorCode.MEMBERSHIP_NOT_FOUND,
                        "Target user is not a member of this workspace"));

        Role role = requireRole(tenantId, roleKey, "workspace");

        WorkspaceMembershipRoleId pk = new WorkspaceMembershipRoleId(wm.getId(), role.getId());
        if (!workspaceMembershipRoleRepo.existsById(pk)) {
            throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND, "Role not assigned to this member");
        }
        workspaceMembershipRoleRepo.deleteById(pk);
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record TenantMemberDto(UUID membershipId, UUID userId, String email, String name,
                                  OffsetDateTime joinedAt, List<String> roles) {}

    public record WorkspaceMemberDto(UUID workspaceMembershipId, UUID userId, String email, String name,
                                     OffsetDateTime joinedAt, List<String> roles) {}

    // ── Private helpers ───────────────────────────────────────────────────────

    private Role requireRole(UUID tenantId, String roleKey, String scopeHint) {
        Role role = roleRepo.findVisibleToTenant(tenantId).stream()
                .filter(r -> roleKey.equals(r.getKey()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException(ErrorCode.ROLE_NOT_FOUND,
                        "Role '" + roleKey + "' not found"));
        if ("platform".equals(role.getScopeType())) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN,
                    "Platform roles cannot be assigned by a tenant administrator");
        }
        if (!scopeHint.equals(role.getScopeType())) {
            throw new ForbiddenException(ErrorCode.INVALID_REQUEST,
                    "Role '" + roleKey + "' has scope '" + role.getScopeType()
                            + "' and cannot be assigned in a '" + scopeHint + "' context");
        }
        return role;
    }

    private void requireWorkspaceInTenant(UUID workspaceId, UUID tenantId) {
        workspaceRepo.findByIdAndTenantId(workspaceId, tenantId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.WORKSPACE_NOT_FOUND,
                        "Workspace not found in this tenant"));
    }
}






