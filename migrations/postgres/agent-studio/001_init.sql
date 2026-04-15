-- agents
-- tenant_id UUID of Finance BU
-- model_config JSONB to store model related config like model name, temperature, etc.
-- agent_type: standalone, tool, router, parallel, etc.
CREATE TABLE agents (
    id                 UUID PRIMARY KEY NOT NULL,
    tenant_id          UUID            NOT NULL,
    name               VARCHAR(255)    NOT NULL,
    description        TEXT,

    model_config       JSONB           NOT NULL DEFAULT '{}',
    memory_config       JSONB           NOT NULL DEFAULT '{}',

    is_active          BOOLEAN         NOT NULL DEFAULT true,
    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,
    created_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- tools
-- type 'api' for external API calls, 'function' for internal functions, etc.
-- config JSONB to store tool specific config like API endpoint, method, headers for API tools or function name and parameters for function tools.
-- {
--   "base_url": "https://customer-service.internal",
--   "path": "/customers/{customer_id}",
--   "method": "GET",
--   "headers_template": {
--     "Authorization": "Bearer {{secret_ref}}"
--   },
--   "query_template": {},
--   "body_template": {},
--   "auth_type": "bearer",
--   "credential": "asdflkjasdlkfjalsd" -- First just store pure credential, in the future we can enhance to support referencing secrets in secret manager, e.g. "credential": {"secret_ref": "customer-service-api-token"}
-- }
CREATE TABLE tools (
    id              UUID PRIMARY KEY NOT NULL,
    tenant_id       UUID            NOT NULL,
    name            VARCHAR(255)    NOT NULL,

    type            VARCHAR(50)     NOT NULL,

    description     TEXT,

    require_approval BOOLEAN NOT NULL DEFAULT false,
    input_schema    JSONB           NOT NULL DEFAULT '{}',
    output_schema   JSONB           NOT NULL DEFAULT '{}',
    config          JSONB           NOT NULL DEFAULT '{}',

    is_active       BOOLEAN         NOT NULL DEFAULT true,
    created_by_user_id UUID         NOT NULL,
    updated_by_user_id UUID         NOT NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- agent_tools
-- Many-to-many relationship between agents and tools, as an agent can use multiple tools and a tool can be used by multiple agents.
CREATE TABLE agent_tools (
    agent_id        UUID            NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tool_id         UUID            NOT NULL REFERENCES tools(id)  ON DELETE CASCADE,
    PRIMARY KEY (agent_id, tool_id),
    CONSTRAINT fk_agent_tools_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_tools_tool FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
);

-- prompt_versions
-- versioning for prompts, as prompts can evolve over time. Only one active version per agent is allowed.
-- context_config JSONB to store additional context related to the prompt, such as TIMESTAMPTZs, user information, or any other relevant data that can help in generating responses.
CREATE TABLE prompt_versions (
    id              UUID PRIMARY KEY NOT NULL,
    agent_id        UUID            NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version         INT             NOT NULL,
    system_prompt   TEXT            NOT NULL,
    context_config  JSONB           NOT NULL DEFAULT '{}',
    is_active       BOOLEAN         NOT NULL DEFAULT false,
    created_by_user_id UUID         NOT NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_prompt_versions_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT uq_prompt_versions_agent_version UNIQUE (agent_id, version)
);

CREATE UNIQUE INDEX idx_prompt_versions_one_active
    ON prompt_versions (agent_id)
    WHERE is_active = true;


-- workflows
CREATE TABLE workflows (
    id              UUID PRIMARY KEY NOT NULL,
    tenant_id       UUID            NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,

    is_active       BOOLEAN         NOT NULL DEFAULT false,
    created_by_user_id UUID         NOT NULL,
    updated_by_user_id UUID         NOT NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- workflow_versions
-- graph = {"nodes": [{"id": "node1", "type": "tool", "tool_id": "tool-uuid", "config": {...}}, ...], "edges": [{"from": "node1", "to": "node2"}, ...]}
-- settings = {"retry_on_failure": true, "max_retries": 3, "timeout": 60}
CREATE TABLE workflow_versions (
    id UUID PRIMARY KEY NOT NULL,
    workflow_id     UUID NOT NULL,
    version INT NOT NULL,
    graph JSONB NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_workflow_versions_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    CONSTRAINT uq_workflow_versions_workflow_version UNIQUE (workflow_id, version)
);


CREATE UNIQUE INDEX uq_workflow_versions_one_active
    ON workflow_versions (workflow_id)
    WHERE is_active = true;

-- sessions
-- Notes:
-- - session is tied to an agent or an workflow run, if session is tied to an agent, it means the session is for a standalone agent, if session is tied to a workflow run, it means the session is for a workflow execution which may involve multiple agents.
CREATE TABLE sessions (
    id              UUID PRIMARY KEY NOT NULL,
    tenant_id       UUID NOT NULL,
    agent_id        UUID,
    session_type VARCHAR(50) NOT NULL DEFAULT 'workflow', -- 'standalone' or 'workflow'
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_sessions_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- workflow_runs
-- Record of one workflow execution
CREATE TABLE workflow_runs (
    id              UUID PRIMARY KEY NOT NULL,
    tenant_id      UUID            NOT NULL,
    workflow_id     UUID            NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_version_id UUID        NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,

    session_id      UUID            REFERENCES sessions(id) ON DELETE SET NULL,
    input           JSONB           NOT NULL DEFAULT '{}',
    output          JSONB,
    status          VARCHAR(50)     NOT NULL DEFAULT 'pending',
    error           TEXT,

    elapsed_time    INT,

    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- node_executions
-- Record of each node execution within a workflow run.
-- Example
-- node_id = "node1"
-- node_type = "agent"
-- input = {"message": "Hello, how can I help you?"}


CREATE TABLE node_executions (
    id              UUID PRIMARY KEY NOT NULL,
    workflow_run_id    UUID            NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,

    node_id         VARCHAR(255)    NOT NULL,
    node_name       VARCHAR(255)    NOT NULL,
    node_type       VARCHAR(50)     NOT NULL,

    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    session_id      UUID            REFERENCES sessions(id) ON DELETE SET NULL,
    iteration       INT             NOT NULL DEFAULT 1,
    approval_status VARCHAR(50)     NOT NULL DEFAULT 'not_required', -- not_required, pending, approved, rejected
    parallel_id      UUID,
    attempt_no         INT             NOT NULL DEFAULT 1,
    branch_key      VARCHAR(255)    NOT NULL DEFAULT 'main',
    input           JSONB           NOT NULL DEFAULT '{}',

    output          JSONB,
    status          VARCHAR(50)     NOT NULL DEFAULT 'pending',

    error           TEXT,

    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_node_execution_identity
    UNIQUE (workflow_run_id, node_id, branch_key, iteration, attempt_no)
);

-- messages
-- role: user, assistant, system, tool, etc.
CREATE TABLE messages (
    id              UUID PRIMARY KEY NOT NULL,
    tenant_id       UUID            NOT NULL,
    session_id      UUID            NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    node_execution_id UUID        REFERENCES node_executions(id) ON DELETE SET NULL,
    role            VARCHAR(50)     NOT NULL,

    content         JSONB            NOT NULL,

    metadata        JSONB           NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_node_executions_workflow_run_id
    ON node_executions (workflow_run_id);

CREATE INDEX idx_workflow_runs_workflow_id
    ON workflow_runs (workflow_id);

CREATE INDEX idx_messages_session_id
    ON messages (session_id);

CREATE INDEX idx_prompt_versions_agent_id
    ON prompt_versions (agent_id);

CREATE INDEX idx_agent_tools_agent_id
    ON agent_tools (agent_id);
