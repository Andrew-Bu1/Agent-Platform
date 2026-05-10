package com.agentplatform.studio.api.internal;

import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.studio.api.flow.FlowVersionDto;
import com.agentplatform.studio.repository.FlowVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/internal/flow-versions")
@RequiredArgsConstructor
public class InternalFlowVersionController {

    private final FlowVersionRepository flowVersionRepository;
    private final ObjectMapper          objectMapper;

    @GetMapping("/{id}")
    public ApiResponse<FlowVersionDto> get(@PathVariable UUID id) {
        var version = flowVersionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("FlowVersion", id));
        return ApiResponse.ok(FlowVersionDto.from(version, objectMapper));
    }
}
