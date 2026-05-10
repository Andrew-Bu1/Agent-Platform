package com.agentplatform.studio.api.flow;

import com.agentplatform.studio.entity.FlowVersion;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class FlowVersionDto {

    private UUID    id;
    private UUID    flowId;
    private Integer version;
    private Object  graph;
    private Object  settings;
    private String  status;
    private UUID    createdByUserId;
    private OffsetDateTime createdAt;

    public static FlowVersionDto from(FlowVersion v, ObjectMapper mapper) {
        return FlowVersionDto.builder()
                .id(v.getId())
                .flowId(v.getFlowId())
                .version(v.getVersion())
                .graph(parse(v.getGraphJson(), mapper))
                .settings(parse(v.getSettingsJson(), mapper))
                .status(v.getStatus())
                .createdByUserId(v.getCreatedByUserId())
                .createdAt(v.getCreatedAt())
                .build();
    }

    private static Object parse(String json, ObjectMapper mapper) {
        try {
            return json != null ? mapper.readValue(json, new TypeReference<Object>() {}) : null;
        } catch (Exception e) {
            return json;
        }
    }
}
