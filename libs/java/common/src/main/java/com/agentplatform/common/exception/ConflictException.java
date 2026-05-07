package com.agentplatform.common.exception;

public class ConflictException extends AppException {

    public ConflictException(ErrorCode errorCode) {
        super(errorCode);
    }

    public ConflictException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }

    public ConflictException(String message) {
        super(ErrorCode.CONFLICT, message);
    }
}
