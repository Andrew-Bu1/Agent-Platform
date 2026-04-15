package com.agentplatform.access.dto;

import com.agentplatform.access.entity.Membership;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MembershipResponse {

    private UUID id;
    private UUID userId;
    private String userEmail;
    private String userName;
    private UUID tenantId;
    private String tenantName;
    private String status;
    private OffsetDateTime joinedAt;
    private OffsetDateTime createdAt;

    public static MembershipResponse from(Membership m) {
        return MembershipResponse.builder()
                .id(m.getId())
                .userId(m.getUser().getId())
                .userEmail(m.getUser().getEmail())
                .userName(m.getUser().getName())
                .tenantId(m.getTenant().getId())
                .tenantName(m.getTenant().getName())
                .status(m.getStatus())
                .joinedAt(m.getJoinedAt())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
