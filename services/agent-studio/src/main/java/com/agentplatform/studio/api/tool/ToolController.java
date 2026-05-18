package com.agentplatform.studio.api.tool;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.common.web.PageResponse;
import com.agentplatform.studio.service.ToolService;
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
@RequestMapping("/api/v1/tools")
@RequiredArgsConstructor
public class ToolController {

    private final ToolService  toolService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ApiResponse<PageResponse<ToolDto>> list(
            @AuthenticationPrincipal AuthContext auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = toolService.list(auth, PageRequest.of(page, size, Sort.by("updatedAt").descending()));
        var mapped = result.map(t -> ToolDto.from(t, objectMapper));
        return ApiResponse.ok(PageResponse.of(mapped));
    }

    @GetMapping("/{id}")
    public ApiResponse<ToolDto> get(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(ToolDto.from(toolService.get(auth, id), objectMapper));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ToolDto> create(@AuthenticationPrincipal AuthContext auth,
                                       @Valid @RequestBody CreateToolRequest req) {
        var tool = toolService.create(auth,
                req.getName(),
                req.getDescription(),
                req.getToolType(),
                JsonUtils.toStringOrDefault(req.getInputSchema(), "{}"),
                JsonUtils.toStringOrDefault(req.getOutputSchema(), "{}"),
                JsonUtils.toStringOrDefault(req.getConfig(), "{}"),
                JsonUtils.toStringOrDefault(req.getApprovalPolicy(), "{}"));
        return ApiResponse.ok(ToolDto.from(tool, objectMapper));
    }

    @PutMapping("/{id}")
    public ApiResponse<ToolDto> update(@AuthenticationPrincipal AuthContext auth,
                                       @PathVariable UUID id,
                                       @RequestBody UpdateToolRequest req) {
        var tool = toolService.update(auth, id,
                req.getName(),
                req.getDescription(),
                JsonUtils.toString(req.getInputSchema()),
                JsonUtils.toString(req.getOutputSchema()),
                JsonUtils.toString(req.getConfig()),
                JsonUtils.toString(req.getApprovalPolicy()),
                req.getStatus());
        return ApiResponse.ok(ToolDto.from(tool, objectMapper));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> archive(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        toolService.archive(auth, id);
        return ApiResponse.ok();
    }
}
