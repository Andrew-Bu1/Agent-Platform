package com.agentplatform.iam.api.entitlement;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.service.EntitlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/entitlements")
@RequiredArgsConstructor
public class EntitlementController {

    private final EntitlementService entitlementService;

    @GetMapping("/features")
    public ResponseEntity<ApiResponse<List<EntitlementService.FeatureEntitlementView>>> features(
            @AuthenticationPrincipal AuthContext ctx) {

        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.getFeatureEntitlements(tenantId)));
    }

    @GetMapping("/models")
    public ResponseEntity<ApiResponse<List<EntitlementService.ModelEntitlementView>>> models(
            @AuthenticationPrincipal AuthContext ctx) {

        UUID tenantId = UUID.fromString(ctx.tenantId());
        return ResponseEntity.ok(ApiResponse.ok(entitlementService.getModelEntitlements(tenantId)));
    }
}
