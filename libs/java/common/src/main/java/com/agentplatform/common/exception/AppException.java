package com.agentplatform.common.exception;

import lombok.Getter;

/**
 * Base application exception. Carry an {@link ErrorCode} for structured error responses.
 * Prefer specific subclasses (NotFoundException, UnauthorizedException, etc.).
 */
@Getter
public class AppException extends RuntimeException {

    private final ErrorCode errorCode;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getCode());
        this.errorCode = errorCode;
    }

    public AppException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public AppException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }
}
