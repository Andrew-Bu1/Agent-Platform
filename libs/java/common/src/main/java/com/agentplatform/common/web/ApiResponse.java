package com.agentplatform.common.web;

import com.fasterxml.jackson.annotation.JsonInclude;
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
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final String error;
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
