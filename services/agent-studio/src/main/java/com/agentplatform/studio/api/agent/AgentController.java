package com.agentplatform.studio.api.agent;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.common.web.PageResponse;
import com.agentplatform.studio.service.AgentService;
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
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ApiResponse<PageResponse<AgentDto>> list(
            @AuthenticationPrincipal AuthContext auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = agentService.list(auth, PageRequest.of(page, size, Sort.by("updatedAt").descending()));
        var mapped = result.map(a -> AgentDto.from(a, objectMapper));
        return ApiResponse.ok(PageResponse.of(mapped));
    }

    @GetMapping("/{id}")
    public ApiResponse<AgentDto> get(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(AgentDto.from(agentService.get(auth, id), objectMapper));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AgentDto> create(@AuthenticationPrincipal AuthContext auth,
                                        @Valid @RequestBody CreateAgentRequest req) {
        var agent = agentService.create(auth,
                req.getName(),
                req.getDescription(),
                req.getAgentKind(),
                JsonUtils.toStringOrDefault(req.getDefinition(), "{}"),
                req.getToolIds(),
                req.getModelId());
        return ApiResponse.ok(AgentDto.from(agent, objectMapper));
    }

    @PutMapping("/{id}")
    public ApiResponse<AgentDto> update(@AuthenticationPrincipal AuthContext auth,
                                        @PathVariable UUID id,
                                        @RequestBody UpdateAgentRequest req) {
        var agent = agentService.update(auth, id,
                req.getName(),
                req.getDescription(),
                req.getAgentKind(),
                JsonUtils.toString(req.getDefinition()),
                req.getToolIds(),
                req.getModelId(),
                req.getStatus());
        return ApiResponse.ok(AgentDto.from(agent, objectMapper));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> archive(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        agentService.archive(auth, id);
        return ApiResponse.ok();
    }
}
