package com.agentplatform.common.exception;

public class NotFoundException extends AppException {

    public NotFoundException(ErrorCode errorCode) {
        super(errorCode);
    }

    public NotFoundException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }

    public NotFoundException(String resourceName, Object id) {
        super(ErrorCode.NOT_FOUND, resourceName + " not found: " + id);
    }
}
