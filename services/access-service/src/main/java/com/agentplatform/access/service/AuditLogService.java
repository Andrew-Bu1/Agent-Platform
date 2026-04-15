package com.agentplatform.access.service;

import com.agentplatform.access.dto.AuditLogResponse;
import com.agentplatform.access.entity.AuditLog;
import com.agentplatform.access.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Saves an audit log entry in a new transaction so that failures
     * in audit logging do not roll back the caller's transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String actorType, String actorId, UUID tenantId,
                    String action, String resourceType, String resourceId,
                    String decision, String reason) {
        try {
            AuditLog entry = AuditLog.builder()
                    .id(UUID.randomUUID())
                    .actorType(actorType)
                    .actorId(actorId != null ? actorId : "unknown")
                    .tenantId(tenantId)
                    .action(action)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .decision(decision != null ? decision : "allow")
                    .reason(reason)
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception ex) {
            log.error("Failed to save audit log [action={}, actor={}, resource={}/{}]: {}",
                    action, actorId, resourceType, resourceId, ex.getMessage());
        }
    }

    /** Convenience overload for 'allow' decisions with no reason. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String actorType, String actorId, UUID tenantId,
                    String action, String resourceType, String resourceId) {
        log(actorType, actorId, tenantId, action, resourceType, resourceId, "allow", null);
    }

    public Page<AuditLogResponse> listAuditLogs(UUID tenantId, String actorId,
                                                 String action, String resourceType,
                                                 String decision, Pageable pageable) {
        boolean hasTenant = tenantId != null;
        boolean hasActor = actorId != null && !actorId.isBlank();
        boolean hasAction = action != null && !action.isBlank();
        boolean hasResource = resourceType != null && !resourceType.isBlank();
        boolean hasDecision = decision != null && !decision.isBlank();

        // Use targeted queries to avoid IS NULL type-inference issues
        if (hasTenant && hasActor && hasAction && hasResource && hasDecision) {
            return auditLogRepository.searchAll(tenantId, actorId, action, resourceType, decision, pageable)
                    .map(AuditLogResponse::from);
        }
        if (hasTenant && hasActor && hasAction && hasResource) {
            return auditLogRepository.searchByTenantActorActionResource(tenantId, actorId, action, resourceType, pageable)
                    .map(AuditLogResponse::from);
        }
        if (hasTenant && !hasActor && !hasAction && !hasResource && !hasDecision) {
            return auditLogRepository.findByTenantId(tenantId, pageable).map(AuditLogResponse::from);
        }
        if (!hasTenant && hasActor && !hasAction && !hasResource && !hasDecision) {
            return auditLogRepository.findByActorId(actorId, pageable).map(AuditLogResponse::from);
        }
        return auditLogRepository.findAll(pageable).map(AuditLogResponse::from);
    }

    public AuditLogResponse getAuditLog(UUID id) {
        return auditLogRepository.findById(id)
                .map(AuditLogResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit log not found"));
    }
}
