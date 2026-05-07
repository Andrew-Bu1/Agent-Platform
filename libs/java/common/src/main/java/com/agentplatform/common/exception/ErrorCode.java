package com.agentplatform.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * Canonical error codes used across all services.
 * Each code maps to an HTTP status for REST responses.
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // ── Generic ──────────────────────────────────────────────────────────────
    INTERNAL_SERVER_ERROR("INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR),
    VALIDATION_ERROR("VALIDATION_ERROR", HttpStatus.BAD_REQUEST),
    INVALID_REQUEST("INVALID_REQUEST", HttpStatus.BAD_REQUEST),
    NOT_FOUND("NOT_FOUND", HttpStatus.NOT_FOUND),
    CONFLICT("CONFLICT", HttpStatus.CONFLICT),

    // ── Auth / IAM ───────────────────────────────────────────────────────────
    UNAUTHORIZED("UNAUTHORIZED", HttpStatus.UNAUTHORIZED),
    FORBIDDEN("FORBIDDEN", HttpStatus.FORBIDDEN),
    TOKEN_EXPIRED("TOKEN_EXPIRED", HttpStatus.UNAUTHORIZED),
    TOKEN_INVALID("TOKEN_INVALID", HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS("INVALID_CREDENTIALS", HttpStatus.UNAUTHORIZED),

    // ── Tenant / Workspace ───────────────────────────────────────────────────
    TENANT_NOT_FOUND("TENANT_NOT_FOUND", HttpStatus.NOT_FOUND),
    TENANT_INACTIVE("TENANT_INACTIVE", HttpStatus.FORBIDDEN),
    WORKSPACE_NOT_FOUND("WORKSPACE_NOT_FOUND", HttpStatus.NOT_FOUND),
    WORKSPACE_INACTIVE("WORKSPACE_INACTIVE", HttpStatus.FORBIDDEN),

    // ── User ─────────────────────────────────────────────────────────────────
    USER_NOT_FOUND("USER_NOT_FOUND", HttpStatus.NOT_FOUND),
    USER_EMAIL_CONFLICT("USER_EMAIL_CONFLICT", HttpStatus.CONFLICT),
    USER_INACTIVE("USER_INACTIVE", HttpStatus.FORBIDDEN),

    // ── Membership ───────────────────────────────────────────────────────────
    MEMBERSHIP_NOT_FOUND("MEMBERSHIP_NOT_FOUND", HttpStatus.NOT_FOUND),
    MEMBERSHIP_ALREADY_EXISTS("MEMBERSHIP_ALREADY_EXISTS", HttpStatus.CONFLICT),

    // ── Role / Permission ────────────────────────────────────────────────────
    ROLE_NOT_FOUND("ROLE_NOT_FOUND", HttpStatus.NOT_FOUND),
    PERMISSION_NOT_FOUND("PERMISSION_NOT_FOUND", HttpStatus.NOT_FOUND),

    // ── Service Client ───────────────────────────────────────────────────────
    SERVICE_CLIENT_NOT_FOUND("SERVICE_CLIENT_NOT_FOUND", HttpStatus.NOT_FOUND),
    SERVICE_CLIENT_INACTIVE("SERVICE_CLIENT_INACTIVE", HttpStatus.FORBIDDEN),

    // ── Entitlement ──────────────────────────────────────────────────────────
    FEATURE_NOT_ENTITLED("FEATURE_NOT_ENTITLED", HttpStatus.FORBIDDEN),
    MODEL_NOT_ENTITLED("MODEL_NOT_ENTITLED", HttpStatus.FORBIDDEN),
    QUOTA_EXCEEDED("QUOTA_EXCEEDED", HttpStatus.TOO_MANY_REQUESTS);

    private final String code;
    private final HttpStatus httpStatus;
}
