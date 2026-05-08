package com.agentplatform.iam.api.feature;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
import com.agentplatform.iam.service.FeatureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/features")
@RequiredArgsConstructor
public class FeatureController {

    private final FeatureService featureService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FeatureDto>>> list() {
        List<FeatureDto> dtos = featureService.listFeatures()
                .stream().map(FeatureDto::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FeatureDto>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(FeatureDto.from(featureService.getFeature(id))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FeatureDto>> create(
            @AuthenticationPrincipal AuthContext ctx,
            @Valid @RequestBody CreateFeatureRequest req) {
        UUID userId = UUID.fromString(ctx.userId());
        FeatureDto dto = FeatureDto.from(
                featureService.createFeature(userId, req.key(), req.name(), req.description()));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(dto));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<FeatureDto>> update(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id,
            @RequestBody UpdateFeatureRequest req) {
        UUID userId = UUID.fromString(ctx.userId());
        return ResponseEntity.ok(ApiResponse.ok(FeatureDto.from(
                featureService.updateFeature(userId, id, req.name(), req.description()))));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal AuthContext ctx,
            @PathVariable UUID id) {
        UUID userId = UUID.fromString(ctx.userId());
        featureService.deleteFeature(userId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
