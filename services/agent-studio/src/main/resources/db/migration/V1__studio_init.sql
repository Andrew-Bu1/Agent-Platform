-- Agent Studio Database Schema v1
--
-- IAM service owns:
--   tenants, users, workspaces, memberships, roles, permissions,
--   service clients, feature entitlements, model entitlements.
--
-- This database stores references only:
--   tenant_id, workspace_id, user_id (plain UUIDs, no cross-DB FKs)
--
-- Design-time tables only:
--   agents, tools, flows, flow_versions
--
-- All runtime tables (threads, runs, node_runs, messages, run_events,
-- human_review_tasks) live in the agent-orchestrator database.


-- 1. AGENTS

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    agent_kind VARCHAR(50) NOT NULL DEFAULT 'single',
    -- single, team

    definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- draft, active, archived

    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_agents_kind CHECK (agent_kind IN ('single', 'team')),
    CONSTRAINT chk_agents_status CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT uq_agents_workspace_name UNIQUE (workspace_id, name)
);


-- 2. TOOLS

CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    tool_type VARCHAR(50) NOT NULL,
    -- http, function, database, webhook, email, internal_service

    input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,

    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    approval_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- active, disabled, archived

    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tools_tool_type CHECK (tool_type IN (
        'http', 'function', 'database', 'webhook', 'email', 'internal_service'
    )),
    CONSTRAINT chk_tools_status CHECK (status IN ('active', 'disabled', 'archived')),
    CONSTRAINT uq_tools_workspace_name UNIQUE (workspace_id, name)
);


-- 3. FLOWS

CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- draft, active, archived

    current_version_id UUID NULL,
    -- FK added after flow_versions table is created (see below)

    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_flows_status CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT uq_flows_workspace_name UNIQUE (workspace_id, name)
);


-- 4. FLOW VERSIONS
--
-- Immutable executable snapshot.
-- graph_json contains: entry_node_id, nodes, edges, UI metadata,
-- agent snapshots, tool snapshots, human review config.

CREATE TABLE IF NOT EXISTS flow_versions (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,

    version INT NOT NULL,

    graph_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- draft, published, archived

    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_flow_versions_status CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT uq_flow_versions_flow_version UNIQUE (flow_id, version)
);

-- Now that flow_versions exists, add the FK from flows.current_version_id
ALTER TABLE flows
    ADD CONSTRAINT fk_flows_current_version
    FOREIGN KEY (current_version_id) REFERENCES flow_versions(id) ON DELETE SET NULL;


-- ── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_agents_tenant_workspace ON agents (tenant_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant_workspace_status ON agents (tenant_id, workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_tools_tenant_workspace ON tools (tenant_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_tools_tenant_workspace_status ON tools (tenant_id, workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_flows_tenant_workspace ON flows (tenant_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_flows_tenant_workspace_status ON flows (tenant_id, workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_flow_versions_flow_id ON flow_versions (flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_versions_tenant_workspace ON flow_versions (tenant_id, workspace_id, flow_id);
