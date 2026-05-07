package com.agentplatform.iam.api.permission;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/permissions")
@RequiredArgsConstructor
public class PermissionController {

    /**
     * Returns the caller's permissions directly from the JWT — no DB hit required.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, List<String>>>> myPermissions(
            @AuthenticationPrincipal AuthContext ctx) {
        return ResponseEntity.ok(ApiResponse.ok(Map.of("permissions", ctx.permissions())));
    }
}
