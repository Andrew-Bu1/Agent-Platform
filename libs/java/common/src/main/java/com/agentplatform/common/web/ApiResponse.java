package com.agentplatform.common.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

/**
 * Unified REST API response envelope.
 * All endpoints return this wrapper so clients get a consistent shape.
 *
 * <pre>
 * Success: { "success": true,  "data": { ... } }
 * Error:   { "success": false, "error": "NOT_FOUND", "message": "User not found: abc" }
 * </pre>
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Unified API response envelope")
public class ApiResponse<T> {

    @Schema(description = "Whether the request succeeded", example = "true")
    private final boolean success;

    @Schema(description = "Response payload (present on success)")
    private final T data;

    @Schema(description = "Error code (present on failure)", example = "NOT_FOUND")
    private final String error;

    @Schema(description = "Human-readable error message (present on failure)", example = "User not found")
    private final String message;

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> ok() {
        return ApiResponse.<T>builder()
                .success(true)
                .build();
    }

    public static <T> ApiResponse<T> error(String errorCode, String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .error(errorCode)
                .message(message)
                .build();
    }
}
