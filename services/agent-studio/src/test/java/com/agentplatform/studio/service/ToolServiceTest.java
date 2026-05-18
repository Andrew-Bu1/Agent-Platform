package com.agentplatform.studio.service;

import com.agentplatform.common.exception.ConflictException;
import com.agentplatform.common.exception.NotFoundException;
import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.entity.Tool;
import com.agentplatform.studio.repository.ToolRepository;
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
class ToolServiceTest {

    @Mock private ToolRepository toolRepo;

    private ToolService toolService;

    private static final String TENANT_ID    = "00000000-0000-0000-0003-000000000001";
    private static final String WORKSPACE_ID = "00000000-0000-0000-0005-000000000001";
    private static final String USER_ID      = "00000000-0000-0000-0002-000000000001";

    @BeforeEach
    void setUp() {
        toolService = new ToolService(toolRepo);
    }

    // ── get ──────────────────────────────────────────────────────────────────

    @Test
    void get_returnsTool_whenFound() {
        Tool tool = savedTool("get_stock_price", "http");
        when(toolRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(tool));

        Tool result = toolService.get(auth(), tool.getId());

        assertThat(result.getName()).isEqualTo("get_stock_price");
    }

    @Test
    void get_throwsNotFound_whenMissing() {
        when(toolRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> toolService.get(auth(), UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }

    // ── create ───────────────────────────────────────────────────────────────

    @Test
    void create_savesHttpTool_withDefaults() {
        when(toolRepo.existsByWorkspaceIdAndName(any(), eq("get_stock_price"))).thenReturn(false);
        ArgumentCaptor<Tool> captor = ArgumentCaptor.forClass(Tool.class);
        when(toolRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        String inputSchema = """
            {"type":"object","properties":{"ticker":{"type":"string"}}}
            """;
        toolService.create(auth(), "get_stock_price", "Fetches live stock price",
                "http", inputSchema, null, null, null);

        Tool saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("get_stock_price");
        assertThat(saved.getToolType()).isEqualTo("http");
        assertThat(saved.getInputSchema()).isEqualTo(inputSchema);
        assertThat(saved.getOutputSchema()).isEqualTo("{}");
        assertThat(saved.getConfigJson()).isEqualTo("{}");
        assertThat(saved.getApprovalPolicyJson()).isEqualTo("{}");
    }

    @Test
    void create_throwsConflict_whenNameAlreadyExists() {
        when(toolRepo.existsByWorkspaceIdAndName(any(), eq("calculate_returns"))).thenReturn(true);

        assertThatThrownBy(() ->
                toolService.create(auth(), "calculate_returns", null, "code", null, null, null, null))
                .isInstanceOf(ConflictException.class);

        verify(toolRepo, never()).save(any());
    }

    @Test
    void create_setsConfigJson() {
        String config = """
            {"url":"https://api.marketdata.app/v1/stocks/quotes/","method":"GET"}
            """;
        when(toolRepo.existsByWorkspaceIdAndName(any(), any())).thenReturn(false);
        ArgumentCaptor<Tool> captor = ArgumentCaptor.forClass(Tool.class);
        when(toolRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        toolService.create(auth(), "get_stock_price", null, "http", null, null, config, null);

        assertThat(captor.getValue().getConfigJson()).isEqualTo(config);
    }

    // ── update ───────────────────────────────────────────────────────────────

    @Test
    void update_changesNameWhenUnique() {
        Tool tool = savedTool("old_name", "http");
        when(toolRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(tool));
        when(toolRepo.existsByWorkspaceIdAndName(any(), eq("new_name"))).thenReturn(false);
        when(toolRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Tool result = toolService.update(auth(), tool.getId(), "new_name",
                null, null, null, null, null, null);

        assertThat(result.getName()).isEqualTo("new_name");
    }

    @Test
    void update_throwsConflict_whenNewNameTaken() {
        Tool tool = savedTool("tool-a", "http");
        when(toolRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(tool));
        when(toolRepo.existsByWorkspaceIdAndName(any(), eq("tool-b"))).thenReturn(true);

        assertThatThrownBy(() ->
                toolService.update(auth(), tool.getId(), "tool-b",
                        null, null, null, null, null, null))
                .isInstanceOf(ConflictException.class);
    }

    // ── archive ──────────────────────────────────────────────────────────────

    @Test
    void archive_setsStatusToArchived() {
        Tool tool = savedTool("obsolete_tool", "code");
        when(toolRepo.findByIdAndTenantIdAndWorkspaceId(any(), any(), any()))
                .thenReturn(Optional.of(tool));
        ArgumentCaptor<Tool> captor = ArgumentCaptor.forClass(Tool.class);
        when(toolRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        toolService.archive(auth(), tool.getId());

        assertThat(captor.getValue().getStatus()).isEqualTo("archived");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static AuthContext auth() {
        return new AuthContext(USER_ID, TENANT_ID, WORKSPACE_ID, USER_ID, null, "access", List.of(), List.of());
    }

    private static Tool savedTool(String name, String type) {
        Tool t = new Tool();
        ReflectionTestUtils.setField(t, "id", UUID.randomUUID());
        t.setName(name);
        t.setToolType(type);
        t.setInputSchema("{}");
        t.setOutputSchema("{}");
        t.setConfigJson("{}");
        t.setApprovalPolicyJson("{}");
        t.setStatus("active");
        return t;
    }
}
