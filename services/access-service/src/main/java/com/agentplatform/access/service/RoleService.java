package com.agentplatform.access.service;

import com.agentplatform.access.dto.*;
import com.agentplatform.access.entity.*;
import com.agentplatform.access.entity.MembershipRole.MembershipRoleId;
import com.agentplatform.access.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final MembershipRepository membershipRepository;
    private final MembershipRoleRepository membershipRoleRepository;

    public Page<RoleResponse> listRoles(String search, Pageable pageable) {
        if (search == null || search.isBlank()) {
            return roleRepository.findAll(pageable).map(RoleResponse::from);
        }
        return roleRepository.search(search, pageable).map(RoleResponse::from);
    }

    public RoleResponse getRole(UUID id) {
        return roleRepository.findById(id)
            .map(RoleResponse::from)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        if (roleRepository.existsByName(request.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Role name already exists");
        }
        Role role = Role.builder()
            .id(UUID.randomUUID())
            .name(request.getName())
            .scopeType(request.getScopeType() != null ? request.getScopeType() : "tenant")
            .description(request.getDescription())
            .isSystem(request.getIsSystem() != null ? request.getIsSystem() : false)
            .build();
        return RoleResponse.from(roleRepository.save(role));
    }

    @Transactional
    public RoleResponse updateRole(UUID id, UpdateRoleRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        if (request.getName() != null && !request.getName().equals(role.getName())) {
            if (roleRepository.existsByName(request.getName())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Role name already exists");
            }
            role.setName(request.getName());
        }
        if (request.getDescription() != null) {
            role.setDescription(request.getDescription());
        }
        return RoleResponse.from(roleRepository.save(role));
    }

    @Transactional
    public void deleteRole(UUID id) {
        if (!roleRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found");
        }
        roleRepository.deleteById(id);
    }

    @Transactional
    public RoleResponse assignPermissions(UUID roleId, AssignPermissionsRequest request) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        List<Permission> permissions = permissionRepository.findAllById(request.getPermissionIds());
        if (permissions.size() != request.getPermissionIds().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more permission IDs not found");
        }
        role.getPermissions().addAll(permissions);
        return RoleResponse.from(roleRepository.save(role));
    }

    @Transactional
    public RoleResponse removePermission(UUID roleId, UUID permissionId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        role.getPermissions().removeIf(p -> p.getId().equals(permissionId));
        return RoleResponse.from(roleRepository.save(role));
    }

    @Transactional
    public List<RoleResponse> getMembershipRoles(UUID membershipId) {
        return membershipRoleRepository.findByMembershipId(membershipId).stream()
                .map(mr -> RoleResponse.from(mr.getRole()))
                .toList();
    }

    @Transactional
    public void assignRoleToMembership(UUID membershipId, UUID roleId) {
        if (!membershipRepository.existsById(membershipId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found");
        }
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        if (membershipRoleRepository.existsByMembership_IdAndRole_Id(membershipId, roleId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Role already assigned to membership");
        }
        Membership membership = membershipRepository.findById(membershipId).get();
        MembershipRole mr = MembershipRole.builder()
                .id(new MembershipRoleId(membershipId, roleId))
                .membership(membership)
                .role(role)
                .build();
        membershipRoleRepository.save(mr);
    }

    @Transactional
    public void removeRoleFromMembership(UUID membershipId, UUID roleId) {
        if (!membershipRoleRepository.existsByMembership_IdAndRole_Id(membershipId, roleId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Role assignment not found");
        }
        membershipRoleRepository.deleteByMembership_IdAndRole_Id(membershipId, roleId);
    }
}
