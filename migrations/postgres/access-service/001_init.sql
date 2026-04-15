
-- tenants
-- Example row:
-- code      = 'finance'
-- name      = 'Finance Business Unit'
-- status    = 'active'
-- plan_key  = 'enterprise'

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,              -- stable slug/key, example: 'finance', 'hr', 'risk'
    name VARCHAR(255) NOT NULL,                     -- display name, example: 'Finance Business Unit'
    status VARCHAR(50) NOT NULL DEFAULT 'active',   -- example: 'active', 'disabled'
    plan_key VARCHAR(100) NOT NULL DEFAULT 'basic', -- example: 'basic', 'pro', 'enterprise'
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,    -- example: {"allow_google_login": true, "region": "ap-southeast-1"}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- users
-- One row = one platform user
--
-- Password login:
-- - email + password_hash
--
-- Google login:
-- - email + google_sub
--
-- Example local user:
-- email         = 'alice@company.com'
-- name          = 'Alice Nguyen'
-- password_hash = '$2b$12$...'
-- google_sub    = null
--
-- Example Google user:
-- email         = 'bob@company.com'
-- name          = 'Bob Tran'
-- password_hash = null
-- google_sub    = '113829473920194723491'

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,             -- login email, example: 'alice@company.com'
    name VARCHAR(255) NOT NULL,                     -- full name, example: 'Alice Nguyen'
    password_hash TEXT NULL,                        -- hashed password only, never raw password
    google_sub VARCHAR(255) UNIQUE NULL,            -- Google 'sub' claim, example: '113829473920194723491'
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,  -- true if email is verified
    avatar_url TEXT NULL,                           -- example: 'https://lh3.googleusercontent.com/...'
    status VARCHAR(50) NOT NULL DEFAULT 'active',   -- example: 'active', 'disabled', 'invited'
    last_login_at TIMESTAMPTZ NULL,                 -- updated on successful login
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- memberships
-- Connects user <-> tenant
-- One user can belong to many tenants/BUs
--
-- Example:
-- user_id   = Alice
-- tenant_id = Finance BU
-- status    = 'active'

CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY NOT NULL,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',   -- example: 'active', 'invited', 'disabled', 'removed'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- when user joined this tenant
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_memberships_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_memberships_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_memberships_user_tenant 
        UNIQUE (user_id, tenant_id)
);


-- roles
-- Example roles:
-- - platform_admin
-- - tenant_admin
-- - agent_runner
-- - datasource_editor

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY NOT NULL,
    scope_type VARCHAR(50) NOT NULL DEFAULT 'tenant', -- example: 'platform', 'tenant'
    name VARCHAR(100) NOT NULL UNIQUE,                -- example: 'tenant_admin'
    description TEXT NULL,                            -- human explanation
    is_system BOOLEAN NOT NULL DEFAULT TRUE,          -- true for built-in roles
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- permissions
-- Atomic actions
-- Example:
-- resource = 'agent', action = 'run'
-- resource = 'datasource', action = 'create'

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY NOT NULL,
    resource VARCHAR(100) NOT NULL,                   -- example: 'agent', 'workflow', 'datasource'
    action VARCHAR(100) NOT NULL,                     -- example: 'create', 'read', 'update', 'delete', 'run'
    description TEXT NULL,                            -- example: 'Allow running agents'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action)
);


-- role_permissions
-- Maps roles -> permissions
-- Example:
-- role 'agent_runner' -> permission 'agent:run'

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);


-- membership_roles
-- Assign roles to a user within a tenant membership
--
-- Example:
-- Alice in Finance BU -> tenant_admin
-- Alice in HR BU      -> agent_runner

CREATE TABLE IF NOT EXISTS membership_roles (
    membership_id UUID NOT NULL,
    role_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (membership_id, role_id),

    CONSTRAINT fk_membership_roles_membership
        FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
    CONSTRAINT fk_membership_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);


-- user_sessions
-- Stores refresh-session state for login/logout
-- Store refresh token HASH only, never raw token
--
-- Example:
-- auth_method        = 'password' or 'google'
-- user_agent         = 'Mozilla/5.0 ...'
-- ip_address         = '10.10.1.20'
-- expires_at         = NOW() + interval '30 days'
-- revoked_at         = null  --> active session
-- revoked_at != null --> logged out / revoked

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY NOT NULL,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    refresh_token_hash TEXT NOT NULL,                -- hashed refresh token
    user_agent TEXT NULL,                            -- browser/device info
    ip_address TEXT NULL,                            -- example: '192.168.1.10'
    auth_method VARCHAR(50) NOT NULL,                -- example: 'password', 'google'
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_sessions_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);


-- feature_entitlements
-- Tenant-level feature switches / product capabilities
--
-- Example feature_key values:
-- - 'agent.run'
-- - 'workflow.create'
-- - 'datasource.ingest'
-- - 'ai.embedding'
-- - 'ai.rerank'
--
-- Example:
-- tenant 'finance' has feature 'agent.run' enabled = true

CREATE TABLE IF NOT EXISTS feature_entitlements (
    id UUID PRIMARY KEY NOT NULL,
    tenant_id UUID NOT NULL,
    feature_key VARCHAR(150) NOT NULL,               -- example: 'agent.run'
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,       -- example: {"max_agents": 50}
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_feature_entitlements_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_feature_entitlements_tenant_feature UNIQUE (tenant_id, feature_key)
);


-- model_entitlements
-- Tenant-level AI model permissions and rate/token limits
--
-- Example:
-- model_key       = 'openrouter:gpt-4.1'
-- operation_type  = 'chat'
-- allowed         = true
-- rpm_limit       = 60
-- monthly_token_limit = 5000000

CREATE TABLE IF NOT EXISTS model_entitlements (
    id UUID PRIMARY KEY NOT NULL,
    tenant_id UUID NOT NULL,
    model_key VARCHAR(150) NOT NULL,                 -- example: 'openrouter:gpt-4.1', 'hf:bge-small-en'
    operation_type VARCHAR(50) NOT NULL,             -- example: 'chat', 'embedding', 'rerank'
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    rpm_limit INTEGER NULL,                          -- requests per minute
    tpm_limit INTEGER NULL,                          -- tokens per minute
    daily_token_limit BIGINT NULL,                   -- example: 100000
    monthly_token_limit BIGINT NULL,                 -- example: 5000000
    config JSONB NOT NULL DEFAULT '{}'::jsonb,       -- example: {"max_context_tokens": 32000}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_model_entitlements_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_model_entitlements_tenant_model_operation
        UNIQUE (tenant_id, model_key, operation_type)
);


-- api_keys
-- For future non-UI / programmatic access
-- Store only hashed secret
--
-- Example:
-- name       = 'Finance nightly sync'
-- key_prefix = 'ak_fin_'
-- scopes     = ['datasource:create', 'agent:run']

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY NOT NULL,
    tenant_id UUID NOT NULL,
    created_by_user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,                      -- display name for this key
    key_prefix VARCHAR(50) NOT NULL,                 -- safe prefix for display/debug
    key_hash TEXT NOT NULL,                          -- hashed API secret only
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,       -- example: ["agent:run","datasource:create"]
    status VARCHAR(50) NOT NULL DEFAULT 'active',    -- example: 'active', 'revoked', 'expired'
    expires_at TIMESTAMPTZ NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_api_keys_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_api_keys_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);


-- audit_logs
-- For audit events
--
-- Example:
-- actor_type    = 'user'
-- actor_id      = user UUID as text
-- action        = 'agent:update'
-- resource_type = 'agent'
-- decision      = 'allow'

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY NOT NULL,
    actor_type VARCHAR(50) NOT NULL,                 -- example: 'user', 'service', 'api_key', 'anonymous'
    actor_id VARCHAR(255) NOT NULL,                  -- user id / service name / key id
    tenant_id UUID NULL,
    action VARCHAR(100) NOT NULL,                    -- example: 'agent:update', 'agent:create', 'agent:delete'
    resource_type VARCHAR(100) NULL,                 -- example: 'agent', 'api_key', 'feature'
    resource_id VARCHAR(255) NULL,                   -- target resource id if any
    decision VARCHAR(50) NOT NULL,                   -- example: 'allow', 'deny'
    reason TEXT NULL,                                -- explanation if denied
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,     -- extra debug context
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_logs_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);