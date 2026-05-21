-- AI Agent Platform - Minimal Studio + Runtime Schema
-- Flow-version-centric, no agent_versions
--
-- IAM service owns:
--   tenants, users, workspaces, memberships, roles, permissions,
--   service clients, feature entitlements, model entitlements.
--
-- This database only stores references:
--   tenant_id
--   workspace_id
--   user_id / created_by_user_id / updated_by_user_id
--
-- Core idea:
--   agents = editable reusable library items
--   tools = editable reusable library items
--   flow_versions = immutable published runtime snapshot

-- 1. AGENTS
--
-- Stores both:
--   react = single ReAct-loop agent (uses tools, has system prompt)
--   team  = supervisor-handoff agent (coordinates member agents via LLM reasoning)
--
-- No agent_versions table.
-- The latest editable agent/team config lives in definition_json.
-- When publishing a flow, copy/snapshot the needed agent config
-- into flow_versions.graph_json.

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    agent_kind VARCHAR(50) NOT NULL DEFAULT 'react',
    -- react, team

    definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    tool_ids UUID[] NOT NULL DEFAULT '{}',
    model_id VARCHAR(255) NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- draft, active, archived

    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_agents_workspace_name
        UNIQUE (workspace_id, name)
);



-- 2. TOOLS
--
-- Tool definitions available to:
--   - agents internally
--   - agent teams internally
--

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

    CONSTRAINT chk_tools_tool_type
        CHECK (tool_type IN (
            'http',
            'function',
            'database',
            'webhook',
            'email',
            'internal_service'
        )),

    CONSTRAINT chk_tools_status
        CHECK (status IN ('active', 'disabled', 'archived')),

    CONSTRAINT uq_tools_workspace_name
        UNIQUE (workspace_id, name)
);


-- 3. FLOWS
--
-- The low-code canvas project.
-- Mutable/editable metadata only.
-- Actual executable snapshots are in flow_versions.

CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- draft, active, archived

    current_version_id UUID NULL,

    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_flows_status
        CHECK (status IN ('draft', 'active', 'archived')),

    CONSTRAINT uq_flows_workspace_name
        UNIQUE (workspace_id, name)
);


-- 4. FLOW VERSIONS
--
-- Immutable executable snapshot.
--
-- graph_json stores:
--   entry_node_id
--   nodes
--   edges
--   UI metadata
--   agent snapshots
--   agent team snapshots
--   tool snapshots
--   human review config
--
-- Supported canvas node types:
--   start
--   end
--   agent
--   agent_team
--   if_else
--   router
--   parallel
--   aggregator
--   human_review


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

    CONSTRAINT chk_flow_versions_status
        CHECK (status IN ('draft', 'published', 'archived')),

    CONSTRAINT uq_flow_versions_flow_version
        UNIQUE (flow_id, version)
);

-- FK deferred because flows is created before flow_versions exists
ALTER TABLE flows
    ADD CONSTRAINT fk_flows_current_version
        FOREIGN KEY (current_version_id)
        REFERENCES flow_versions(id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;




-- 5. THREADS
--
-- Conversation/session boundary.
-- A thread can contain multiple runs.

CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    user_id UUID NULL,

    title VARCHAR(255) NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 6. RUNS
--
-- One execution of one published flow version.

CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    thread_id UUID NULL REFERENCES threads(id) ON DELETE SET NULL,

    flow_id UUID NULL REFERENCES flows(id) ON DELETE SET NULL,
    flow_version_id UUID NOT NULL REFERENCES flow_versions(id) ON DELETE RESTRICT,

    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending, running, waiting_for_human, waiting_for_event,
    -- completed, failed, cancelled, rejected, human_takeover

    input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json JSONB NULL,
    error_json JSONB NULL,

    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 7. NODE RUNS
--
-- One execution of one canvas node inside a run.

CREATE TABLE IF NOT EXISTS node_runs (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,

    node_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    -- start, end, agent, agent_team, if_else, router, parallel, aggregator,
    -- human_review
    node_name VARCHAR(255) NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending, running, waiting, completed, failed, skipped

    branch_key VARCHAR(255) NOT NULL DEFAULT 'main',
    iteration INT NOT NULL DEFAULT 1,
    attempt_no INT NOT NULL DEFAULT 1,

    input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json JSONB NULL,
    error_json JSONB NULL,

    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    CONSTRAINT chk_node_runs_status
        CHECK (status IN (
            'pending',
            'running',
            'waiting',
            'completed',
            'failed',
            'skipped'
        )),

    CONSTRAINT uq_node_runs_identity
        UNIQUE (run_id, node_id, branch_key, iteration, attempt_no)
);




-- 8. MESSAGES
--
-- Conversation messages.
-- These are not the same as run_events.
--
-- Use messages for:
--   user messages
--   assistant messages
--   visible tool messages if needed
--
-- Use run_events for:
--   execution timeline
--   debugging
--   audit
--   streaming

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    run_id UUID NULL REFERENCES runs(id) ON DELETE SET NULL,
    node_run_id UUID NULL REFERENCES node_runs(id) ON DELETE SET NULL,

    role VARCHAR(50) NOT NULL,
    -- user, assistant, system, tool

    content_json JSONB NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- 9. RUN EVENTS
--
-- Append-only execution timeline.
--
-- Use this for:
--   streaming canvas updates
--   debugging
--   audit
--   future replay
--   model/tool/human review trace

CREATE TABLE IF NOT EXISTS run_events (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    node_run_id UUID NULL REFERENCES node_runs(id) ON DELETE SET NULL,

    sequence_no BIGSERIAL NOT NULL,

    event_type VARCHAR(100) NOT NULL,
    -- RunStarted
    -- RunCompleted
    -- RunFailed
    -- NodeStarted
    -- NodeCompleted
    -- NodeFailed
    -- AgentStarted
    -- AgentCompleted
    -- AgentStepStarted
    -- AgentStepCompleted
    -- ToolCallRequested
    -- ToolCallCompleted
    -- ToolCallFailed
    -- HumanReviewRequested
    -- HumanReviewCompleted
    -- CheckpointCreated
    -- StatePatched

    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_run_events_run_sequence
        UNIQUE (run_id, sequence_no)
);



-- 10. HUMAN REVIEW TASKS
--
-- First-class human review / approval / edit / takeover task.
--
-- Created when:
--   - human_review node pauses the run
--   - a tool approval policy requires human approval

CREATE TABLE IF NOT EXISTS human_review_tasks (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    node_run_id UUID NOT NULL REFERENCES node_runs(id) ON DELETE CASCADE,

    status VARCHAR(50) NOT NULL DEFAULT 'waiting',
    -- waiting, claimed, in_review, approved, approved_with_edits,
    -- changes_requested, rejected, takeover, cancelled, expired

    queue_id VARCHAR(150) NULL,
    assigned_to_user_id UUID NULL,

    required_roles_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,

    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    form_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    decision_json JSONB NULL,

    priority VARCHAR(50) NOT NULL DEFAULT 'normal',
    -- low, normal, high, urgent

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    due_at TIMESTAMPTZ NULL
);


-- INDEXES

CREATE INDEX idx_runs_status
    ON runs(tenant_id, workspace_id, status);

CREATE INDEX idx_runs_thread_id
    ON runs(thread_id)
    WHERE thread_id IS NOT NULL;

CREATE INDEX idx_node_runs_run_id
    ON node_runs(run_id);

CREATE INDEX idx_run_events_run_id_seq
    ON run_events(run_id, sequence_no);

CREATE INDEX idx_messages_thread_id
    ON messages(thread_id, created_at);

CREATE INDEX idx_human_review_tasks_run_id
    ON human_review_tasks(run_id);

CREATE INDEX idx_human_review_tasks_status
    ON human_review_tasks(tenant_id, workspace_id, status);

CREATE INDEX idx_agents_workspace
    ON agents(tenant_id, workspace_id);

CREATE INDEX idx_tools_workspace
    ON tools(tenant_id, workspace_id);

CREATE INDEX idx_flows_workspace
    ON flows(tenant_id, workspace_id);

