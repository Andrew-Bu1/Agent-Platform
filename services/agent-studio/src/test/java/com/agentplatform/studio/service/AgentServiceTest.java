package com.agentplatform.studio.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.entity.Agent;
import com.agentplatform.studio.repository.AgentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgentServiceTest {

    @Mock private AgentRepository agentRepo;

    private AgentService agentService;

    private static final String TENANT_ID    = "00000000-0000-0000-0003-000000000001";
    private static final String WORKSPACE_ID = "00000000-0000-0000-0005-000000000001";
    private static final String USER_ID      = "00000000-0000-0000-0002-000000000001";

    @BeforeEach
    void setUp() {
        agentService = new AgentService(agentRepo);
    }

    // ── list ─────────────────────────────────────────────────────────────────

    @Test
    void list_returnsPageFromRepository() {
        Agent a = savedAgent("Market Analyst");
        Page<Agent> page = new PageImpl<>(List.of(a));
        when(agentRepo.findByTenantIdAndWorkspaceIdAndStatusNot(any(), any(), eq("archived"), any()))
                .thenReturn(page);

        Page<Agent> result = agentService.list(auth(), PageRequest.of(0, 20));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getName()).isEqualTo("Market Analyst");
    }

    // ── get ──────────────────────────────────────────────────────────────────

    @Test
    void get_returnsAgentWhenFound() {
        Agent a = savedAgent("Research Agent");
        when(agentRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(a));

        Agent result = agentService.get(auth(), a.getId());

        assertThat(result.getName()).isEqualTo("Research Agent");
    }

    @Test
    void get_throwsNotFound_whenAgentMissing() {
        when(agentRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> agentService.get(auth(), UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }

    // ── create ───────────────────────────────────────────────────────────────

    @Test
    void create_savesAgentWithCorrectDefaults() {
        when(agentRepo.existsByWorkspaceIdAndName(any(), eq("New Agent"))).thenReturn(false);
        ArgumentCaptor<Agent> captor = ArgumentCaptor.forClass(Agent.class);
        when(agentRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        agentService.create(auth(), "New Agent", "Desc", null, null, null, "claude-3-5-sonnet");

        Agent saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("New Agent");
        assertThat(saved.getAgentKind()).isEqualTo("single");
        assertThat(saved.getDefinitionJson()).isEqualTo("{}");
        assertThat(saved.getToolIds()).isEmpty();
        assertThat(saved.getModelId()).isEqualTo("claude-3-5-sonnet");
    }

    @Test
    void create_throwsConflict_whenNameExists() {
        when(agentRepo.existsByWorkspaceIdAndName(any(), eq("Duplicate"))).thenReturn(true);

        assertThatThrownBy(() ->
                agentService.create(auth(), "Duplicate", null, null, null, null, null))
                .isInstanceOf(ConflictException.class);

        verify(agentRepo, never()).save(any());
    }

    @Test
    void create_setsToolIds() {
        List<UUID> toolIds = List.of(UUID.randomUUID(), UUID.randomUUID());
        when(agentRepo.existsByWorkspaceIdAndName(any(), any())).thenReturn(false);
        ArgumentCaptor<Agent> captor = ArgumentCaptor.forClass(Agent.class);
        when(agentRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        agentService.create(auth(), "Tool Agent", null, "react", null, toolIds, null);

        assertThat(captor.getValue().getToolIds()).containsExactlyElementsOf(toolIds);
    }

    // ── update ───────────────────────────────────────────────────────────────

    @Test
    void update_changesNameWhenDifferentAndUnique() {
        Agent existing = savedAgent("Old Name");
        when(agentRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(existing));
        when(agentRepo.existsByWorkspaceIdAndName(any(), eq("New Name"))).thenReturn(false);
        when(agentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Agent result = agentService.update(auth(), existing.getId(), "New Name",
                null, null, null, null, null, null);

        assertThat(result.getName()).isEqualTo("New Name");
    }

    @Test
    void update_throwsConflict_whenNewNameAlreadyTaken() {
        Agent existing = savedAgent("Agent A");
        when(agentRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(existing));
        when(agentRepo.existsByWorkspaceIdAndName(any(), eq("Agent B"))).thenReturn(true);

        assertThatThrownBy(() ->
                agentService.update(auth(), existing.getId(), "Agent B",
                        null, null, null, null, null, null))
                .isInstanceOf(ConflictException.class);
    }

    // ── archive ──────────────────────────────────────────────────────────────

    @Test
    void archive_setsStatusToArchived() {
        Agent a = savedAgent("To Archive");
        when(agentRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(a));
        ArgumentCaptor<Agent> captor = ArgumentCaptor.forClass(Agent.class);
        when(agentRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        agentService.archive(auth(), a.getId());

        assertThat(captor.getValue().getStatus()).isEqualTo("archived");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static AuthContext auth() {
        return new AuthContext(USER_ID, TENANT_ID, WORKSPACE_ID, USER_ID, null, "access", List.of(), List.of());
    }

    private static Agent savedAgent(String name) {
        Agent a = new Agent();
        ReflectionTestUtils.setField(a, "id", UUID.randomUUID());
        a.setName(name);
        a.setAgentKind("single");
        a.setDefinitionJson("{}");
        a.setToolIds(List.of());
        a.setStatus("draft");
        return a;
    }
}
