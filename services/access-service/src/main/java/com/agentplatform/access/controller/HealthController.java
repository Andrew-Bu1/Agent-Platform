package com.agentplatform.access.controller;

import com.agentplatform.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

@RestController
@RequestMapping("/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        Map<String, Object> info = Map.of(
                "status", "UP",
                "service", "access-service",
                "timestamp", OffsetDateTime.now().toString()
        );
        return ResponseEntity.ok(ApiResponse.ok(info));
    }
}
