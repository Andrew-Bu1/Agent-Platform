package com.agentplatform.access.controller;

import com.agentplatform.access.dto.AuditLogResponse;
import com.agentplatform.access.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
@Tag(name = "Audit Logs", description = "Audit log query")
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    @Operation(summary = "Query audit logs")
    public ResponseEntity<Page<AuditLogResponse>> listAuditLogs(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Filter by tenant ID") @RequestParam(required = false) UUID tenantId,
            @Parameter(description = "Filter by actor ID") @RequestParam(required = false) String actorId,
            @Parameter(description = "Filter by action", example = "user:login") @RequestParam(required = false) String action,
            @Parameter(description = "Filter by resource type", example = "user") @RequestParam(required = false) String resourceType,
            @Parameter(description = "Filter by decision", example = "allow") @RequestParam(required = false) String decision,
            @PageableDefault(size = 50, sort = "createdAt") Pageable pageable) {
        return ResponseEntity.ok(auditLogService.listAuditLogs(tenantId, actorId, action, resourceType, decision, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get audit log entry by ID")
    public ResponseEntity<AuditLogResponse> getAuditLog(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        return ResponseEntity.ok(auditLogService.getAuditLog(id));
    }
}
