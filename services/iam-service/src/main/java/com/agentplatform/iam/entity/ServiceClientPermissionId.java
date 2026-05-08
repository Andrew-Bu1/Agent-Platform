package com.agentplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServiceClientPermissionId implements Serializable {

    @Column(name = "service_client_id", nullable = false)
    private UUID serviceClientId;

    @Column(name = "permission_id", nullable = false)
    private UUID permissionId;
}
