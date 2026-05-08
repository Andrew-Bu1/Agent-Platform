package com.agentplatform.iam.api.serviceclient;

import com.agentplatform.iam.entity.ServiceClient;

import java.util.List;
import java.util.UUID;

public record ServiceClientDto(
        UUID         id,
        UUID         tenantId,
        String       clientId,
        String       serviceName,
        String       description,
        List<String> allowedAudiences,
        int          accessTokenTtlSeconds,
        boolean      isActive
) {
    public static ServiceClientDto from(ServiceClient sc) {
        return new ServiceClientDto(
                sc.getId(), sc.getTenantId(), sc.getClientId(),
                sc.getServiceName(), sc.getDescription(),
                sc.getAllowedAudiences(), sc.getAccessTokenTtlSeconds(),
                sc.isActive());
    }
}
