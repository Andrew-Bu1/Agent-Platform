package com.agentplatform.studio.service;

import com.agentplatform.common.exception.AppException;
import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.ForbiddenException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.entity.Flow;
import com.agentplatform.studio.entity.FlowVersion;
import com.agentplatform.studio.repository.FlowRepository;
import com.agentplatform.studio.repository.FlowVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FlowServiceTest {

    @Mock private FlowRepository        flowRepo;
    @Mock private FlowVersionRepository versionRepo;

    private FlowService flowService;

    private static final String TENANT_ID    = "00000000-0000-0000-0003-000000000001";
    private static final String WORKSPACE_ID = "00000000-0000-0000-0005-000000000001";
    private static final String USER_ID      = "00000000-0000-0000-0002-000000000001";

    @BeforeEach
    void setUp() {
        flowService = new FlowService(flowRepo, versionRepo, new ObjectMapper());
    }

    // ── create ───────────────────────────────────────────────────────────────

    @Test
    void create_savesFlowWithCorrectFields() {
        when(flowRepo.existsByWorkspaceIdAndName(any(), eq("FinAI Flow"))).thenReturn(false);
        ArgumentCaptor<Flow> captor = ArgumentCaptor.forClass(Flow.class);
        when(flowRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        flowService.create(auth(), "FinAI Flow", "Financial analysis pipeline");

        Flow saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("FinAI Flow");
        assertThat(saved.getDescription()).isEqualTo("Financial analysis pipeline");
    }

    @Test
    void create_throwsConflict_whenNameExists() {
        when(flowRepo.existsByWorkspaceIdAndName(any(), eq("Duplicate"))).thenReturn(true);

        assertThatThrownBy(() -> flowService.create(auth(), "Duplicate", null))
                .isInstanceOf(ConflictException.class);
        verify(flowRepo, never()).save(any());
    }

    // ── createVersion ────────────────────────────────────────────────────────

    @Test
    void createVersion_incrementsVersionNumber() {
        Flow flow = savedFlow("My Flow");
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(eq(flow.getId()), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findMaxVersionByFlowId(flow.getId())).thenReturn(2);
        ArgumentCaptor<FlowVersion> captor = ArgumentCaptor.forClass(FlowVersion.class);
        when(versionRepo.save(captor.capture())).thenAnswer(inv -> {
            FlowVersion v = inv.getArgument(0);
            ReflectionTestUtils.setField(v, "id", UUID.randomUUID());
            return v;
        });
        when(flowRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FlowVersion version = flowService.createVersion(auth(), flow.getId(), validGraph(), null);

        assertThat(captor.getValue().getVersion()).isEqualTo(3);
    }

    @Test
    void createVersion_usesDefaultGraphJson_whenNull() {
        Flow flow = savedFlow("Flow");
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findMaxVersionByFlowId(any())).thenReturn(0);
        ArgumentCaptor<FlowVersion> captor = ArgumentCaptor.forClass(FlowVersion.class);
        when(versionRepo.save(captor.capture())).thenAnswer(inv -> {
            FlowVersion v = inv.getArgument(0);
            ReflectionTestUtils.setField(v, "id", UUID.randomUUID());
            return v;
        });
        when(flowRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        flowService.createVersion(auth(), flow.getId(), null, null);

        assertThat(captor.getValue().getGraphJson()).isEqualTo("{}");
    }

    // ── publish ──────────────────────────────────────────────────────────────

    @Test
    void publish_setsStatusToPublishedAndFlowToActive() {
        Flow flow = savedFlow("Flow");
        FlowVersion version = draftVersion(flow.getId(), validGraph());
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findByIdAndFlowId(any(), any())).thenReturn(Optional.of(version));
        when(versionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(flowRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FlowVersion published = flowService.publish(auth(), flow.getId(), version.getId());

        assertThat(published.getStatus()).isEqualTo("published");
        assertThat(flow.getStatus()).isEqualTo("active");
    }

    @Test
    void publish_throwsForbidden_whenVersionAlreadyPublished() {
        Flow flow = savedFlow("Flow");
        FlowVersion version = draftVersion(flow.getId(), validGraph());
        version.setStatus("published");
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findByIdAndFlowId(any(), any())).thenReturn(Optional.of(version));

        assertThatThrownBy(() -> flowService.publish(auth(), flow.getId(), version.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void publish_throwsValidationError_whenGraphMissingEntryNodeId() {
        Flow flow = savedFlow("Flow");
        String badGraph = """
            {"nodes":{"start":{"type":"start","label":"Start"}}}
            """;
        FlowVersion version = draftVersion(flow.getId(), badGraph);
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findByIdAndFlowId(any(), any())).thenReturn(Optional.of(version));

        assertThatThrownBy(() -> flowService.publish(auth(), flow.getId(), version.getId()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("entry_node_id");
    }

    @Test
    void publish_throwsValidationError_whenGraphHasNoNodes() {
        Flow flow = savedFlow("Flow");
        String badGraph = """
            {"entry_node_id":"start","nodes":{}}
            """;
        FlowVersion version = draftVersion(flow.getId(), badGraph);
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findByIdAndFlowId(any(), any())).thenReturn(Optional.of(version));

        assertThatThrownBy(() -> flowService.publish(auth(), flow.getId(), version.getId()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("node");
    }

    @Test
    void publish_throwsValidationError_whenGraphJsonInvalid() {
        Flow flow = savedFlow("Flow");
        FlowVersion version = draftVersion(flow.getId(), "not-valid-json");
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findByIdAndFlowId(any(), any())).thenReturn(Optional.of(version));

        assertThatThrownBy(() -> flowService.publish(auth(), flow.getId(), version.getId()))
                .isInstanceOf(AppException.class);
    }

    // ── updateVersion ────────────────────────────────────────────────────────

    @Test
    void updateVersion_throwsForbidden_whenNotDraft() {
        Flow flow = savedFlow("Flow");
        FlowVersion version = draftVersion(flow.getId(), validGraph());
        version.setStatus("published");
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        when(versionRepo.findByIdAndFlowId(any(), any())).thenReturn(Optional.of(version));

        assertThatThrownBy(() ->
                flowService.updateVersion(auth(), flow.getId(), version.getId(), validGraph(), null))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── archive ──────────────────────────────────────────────────────────────

    @Test
    void archive_setsStatusToArchived() {
        Flow flow = savedFlow("To Archive");
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(flow));
        ArgumentCaptor<Flow> captor = ArgumentCaptor.forClass(Flow.class);
        when(flowRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        flowService.archive(auth(), flow.getId());

        assertThat(captor.getValue().getStatus()).isEqualTo("archived");
    }

    // ── get ──────────────────────────────────────────────────────────────────

    @Test
    void get_throwsNotFound_whenFlowMissing() {
        when(flowRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> flowService.get(auth(), UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static AuthContext auth() {
        return new AuthContext(USER_ID, TENANT_ID, WORKSPACE_ID, USER_ID, null, "access", List.of(), List.of());
    }

    private static Flow savedFlow(String name) {
        Flow f = new Flow();
        ReflectionTestUtils.setField(f, "id", UUID.randomUUID());
        f.setName(name);
        f.setStatus("draft");
        return f;
    }

    private static FlowVersion draftVersion(UUID flowId, String graphJson) {
        FlowVersion v = new FlowVersion();
        ReflectionTestUtils.setField(v, "id", UUID.randomUUID());
        v.setFlowId(flowId);
        v.setStatus("draft");
        v.setGraphJson(graphJson);
        v.setSettingsJson("{}");
        return v;
    }

    private static String validGraph() {
        return """
            {
              "entry_node_id": "start",
              "nodes": {
                "start": {"type": "start", "label": "Start"},
                "end":   {"type": "end",   "label": "End"}
              },
              "edges": [{"id":"e1","source":"start","target":"end"}]
            }
            """;
    }
}
