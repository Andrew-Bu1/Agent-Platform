package com.agentplatform.studio.api.flow;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.common.web.PageResponse;
import com.agentplatform.studio.service.FeatureGuardService;
import com.agentplatform.studio.service.FlowService;
import com.agentplatform.studio.util.JsonUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/flows")
@RequiredArgsConstructor
public class FlowController {

    private final FlowService  flowService;
    private final ObjectMapper objectMapper;
    private final FeatureGuardService featureGuard;

    @GetMapping
    public ApiResponse<PageResponse<FlowDto>> list(
            @AuthenticationPrincipal AuthContext auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        auth.requirePermission("flow:read");
        var result = flowService.list(auth, PageRequest.of(page, size, Sort.by("updatedAt").descending()));
        var mapped = result.map(FlowDto::from);
        return ApiResponse.ok(PageResponse.of(mapped));
    }

    @GetMapping("/{id}")
    public ApiResponse<FlowDto> get(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        auth.requirePermission("flow:read");
        return ApiResponse.ok(FlowDto.from(flowService.get(auth, id)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<FlowDto> create(@AuthenticationPrincipal AuthContext auth,
                                       @Valid @RequestBody CreateFlowRequest req) {
        auth.requirePermission("flow:create");
        featureGuard.require(auth, "agent_studio.flows");
        return ApiResponse.ok(FlowDto.from(flowService.create(auth, req.getName(), req.getDescription())));
    }

    @PutMapping("/{id}")
    public ApiResponse<FlowDto> update(@AuthenticationPrincipal AuthContext auth,
                                       @PathVariable UUID id,
                                       @RequestBody UpdateFlowRequest req) {
        auth.requirePermission("flow:update");
        featureGuard.require(auth, "agent_studio.flows");
        return ApiResponse.ok(FlowDto.from(
                flowService.update(auth, id, req.getName(), req.getDescription(), req.getStatus())));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> archive(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        auth.requirePermission("flow:delete");
        featureGuard.require(auth, "agent_studio.flows");
        flowService.archive(auth, id);
        return ApiResponse.ok();
    }

    // ── Versions ─────────────────────────────────────────────────────────────

    @GetMapping("/{id}/versions")
    public ApiResponse<PageResponse<FlowVersionDto>> listVersions(
            @AuthenticationPrincipal AuthContext auth,
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        auth.requirePermission("flow:read");
        var result = flowService.listVersions(auth, id, PageRequest.of(page, size, Sort.by("version").descending()));
        var mapped = result.map(v -> FlowVersionDto.from(v, objectMapper));
        return ApiResponse.ok(PageResponse.of(mapped));
    }

    @GetMapping("/{id}/versions/{versionId}")
    public ApiResponse<FlowVersionDto> getVersion(@AuthenticationPrincipal AuthContext auth,
                                                   @PathVariable UUID id,
                                                   @PathVariable UUID versionId) {
        auth.requirePermission("flow:read");
        return ApiResponse.ok(FlowVersionDto.from(flowService.getVersion(auth, id, versionId), objectMapper));
    }

    @PostMapping("/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<FlowVersionDto> createVersion(@AuthenticationPrincipal AuthContext auth,
                                                      @PathVariable UUID id,
                                                      @RequestBody SaveFlowVersionRequest req) {
        auth.requirePermission("flow:update");
        featureGuard.require(auth, "agent_studio.flows");
        var version = flowService.createVersion(auth, id,
                JsonUtils.toStringOrDefault(req.getGraph(), "{}"),
                JsonUtils.toStringOrDefault(req.getSettings(), "{}"));
        return ApiResponse.ok(FlowVersionDto.from(version, objectMapper));
    }

    @PutMapping("/{id}/versions/{versionId}")
    public ApiResponse<FlowVersionDto> updateVersion(@AuthenticationPrincipal AuthContext auth,
                                                      @PathVariable UUID id,
                                                      @PathVariable UUID versionId,
                                                      @RequestBody SaveFlowVersionRequest req) {
        auth.requirePermission("flow:update");
        featureGuard.require(auth, "agent_studio.flows");
        var version = flowService.updateVersion(auth, id, versionId,
                JsonUtils.toString(req.getGraph()),
                JsonUtils.toString(req.getSettings()));
        return ApiResponse.ok(FlowVersionDto.from(version, objectMapper));
    }

    @PostMapping("/{id}/versions/{versionId}/publish")
    public ApiResponse<FlowVersionDto> publish(@AuthenticationPrincipal AuthContext auth,
                                                @PathVariable UUID id,
                                                @PathVariable UUID versionId) {
        auth.requirePermission("flow:publish");
        featureGuard.require(auth, "agent_studio.flows");
        return ApiResponse.ok(FlowVersionDto.from(flowService.publish(auth, id, versionId), objectMapper));
    }
}
