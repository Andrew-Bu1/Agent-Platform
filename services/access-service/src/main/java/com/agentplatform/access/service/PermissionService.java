package com.agentplatform.access.service;

import com.agentplatform.access.dto.CreatePermissionRequest;
import com.agentplatform.access.dto.PermissionResponse;
import com.agentplatform.access.entity.Permission;
import com.agentplatform.access.repository.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PermissionService {

    private final PermissionRepository permissionRepository;

    public Page<PermissionResponse> listPermissions(String search, Pageable pageable) {
        if (search == null || search.isBlank()) {
            return permissionRepository.findAll(pageable).map(PermissionResponse::from);
        }
        return permissionRepository.search(search, pageable).map(PermissionResponse::from);
    }

    public PermissionResponse getPermission(UUID id) {
        return permissionRepository.findById(id)
                .map(PermissionResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found"));
    }

    @Transactional
    public PermissionResponse createPermission(CreatePermissionRequest request) {
        if (permissionRepository.existsByResourceAndAction(request.getResource(), request.getAction())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Permission already exists for resource='" + request.getResource() + "' action='" + request.getAction() + "'");
        }
        Permission permission = Permission.builder()
                .id(UUID.randomUUID())
                .resource(request.getResource())
                .action(request.getAction())
                .description(request.getDescription())
                .build();
        return PermissionResponse.from(permissionRepository.save(permission));
    }

    @Transactional
    public void deletePermission(UUID id) {
        if (!permissionRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found");
        }
        permissionRepository.deleteById(id);
    }
}
