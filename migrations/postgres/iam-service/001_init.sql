-- IAM / Access Service Schema v1
-- Includes tenant + workspace access model.
--
-- Clean hierarchy:
--   tenant  = company/customer/billing boundary
--   workspace = department/team/project/resource boundary
--
-- Authorization:
--   Human user:
--     user -> tenant membership -> tenant role -> permissions
--     user -> workspace membership -> workspace role -> permissions
--
--   Service-to-service:
--     service_client -> permissions
--     service_client -> allowed audiences
--
-- Entitlement:
--   tenant -> features
--   tenant -> model entitlements
--   tenant -> quota limits

-- 1. TENANTS
-- One company/customer/business account.
-- Example: ACME Corp, Finance BU, HR BU.
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY NOT NULL,

    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active',
    plan_key VARCHAR(100) NOT NULL DEFAULT 'basic',

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USERS
-- Human platform users only.
-- Service clients are stored in service_clients, not users.
--
-- Example:
--   email = 'alice@acme.com'
--   password_hash = bcrypt/argon2id hash
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,

    password_hash TEXT NULL,
    password_algorithm VARCHAR(100) NULL DEFAULT 'bcrypt',

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    last_login_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MEMBERSHIPS
-- User belongs to a tenant/company.
-- This does not automatically grant access to every workspace.
--
-- Example:
--   Alice belongs to ACME tenant.
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_memberships_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT fk_memberships_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CONSTRAINT uq_memberships_tenant_user
        UNIQUE (tenant_id, user_id),

    CONSTRAINT uq_memberships_id_tenant
        UNIQUE (id, tenant_id)
);

-- 4. WORKSPACES
-- Department/team/project inside a tenant.
-- Studio resources should belong to a workspace:
--   agents, tools, prompts, workflows, memory, datasources.
--
-- Example:
--   tenant = ACME
--   workspace = Finance Automation
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,

    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by_user_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_workspaces_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT fk_workspaces_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    CONSTRAINT uq_workspaces_tenant_code
        UNIQUE (tenant_id, code),

    CONSTRAINT uq_workspaces_id_tenant
        UNIQUE (id, tenant_id)
);

-- 5. WORKSPACE MEMBERSHIPS
-- Grants a tenant membership access to a specific workspace.
--
-- Example:
--   Alice belongs to ACME tenant.
--   Alice also belongs to ACME / Finance workspace.
CREATE TABLE IF NOT EXISTS workspace_memberships (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    membership_id UUID NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_workspace_memberships_workspace
        FOREIGN KEY (workspace_id, tenant_id) REFERENCES workspaces(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT fk_workspace_memberships_membership
        FOREIGN KEY (membership_id, tenant_id) REFERENCES memberships(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT uq_workspace_memberships_workspace_membership
        UNIQUE (workspace_id, membership_id)
);

-- 6. PERMISSIONS
-- Atomic abilities checked by backend code.
--
-- Examples:
--   datasource:delete
--   agent:run
--   workflow:execute
--   model:invoke
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY NOT NULL,

    key VARCHAR(200) NOT NULL UNIQUE,

    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,

    description TEXT NULL,

    is_system BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_permissions_resource_action
        UNIQUE (resource, action)
);

-- 7. ROLES
-- Bundles of permissions for users.
--
-- scope_type:
--   platform  = global/platform role
--   tenant    = company-level role
--   workspace = workspace-level role
--
-- Example:
--   tenant_admin
--   workspace_owner
--   agent_builder
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NULL,

    key VARCHAR(150) NOT NULL,
    name VARCHAR(255) NOT NULL,

    scope_type VARCHAR(50) NOT NULL DEFAULT 'workspace',

    description TEXT NULL,

    is_system BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_roles_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT chk_roles_scope_type
        CHECK (scope_type IN ('platform', 'tenant', 'workspace'))
);



-- 8. ROLE PERMISSIONS
-- Maps role -> permission.
--
-- Example:
--   agent_builder -> agent:create
--   agent_builder -> prompt:update
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

-- 9. MEMBERSHIP ROLES
-- Tenant-level roles assigned to tenant memberships.
--
-- Example:
--   Alice in ACME -> tenant_admin
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

-- 10. WORKSPACE MEMBERSHIP ROLES
-- Workspace-level roles assigned to workspace memberships.
--
-- Example:
--   Alice in ACME / Finance -> workspace_owner
CREATE TABLE IF NOT EXISTS workspace_membership_roles (
    workspace_membership_id UUID NOT NULL,
    role_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (workspace_membership_id, role_id),

    CONSTRAINT fk_workspace_membership_roles_membership
        FOREIGN KEY (workspace_membership_id) REFERENCES workspace_memberships(id) ON DELETE CASCADE,

    CONSTRAINT fk_workspace_membership_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 11. SERVICE CLIENTS
-- OAuth2 client_credentials clients for service-to-service communication.
-- Example:
--   client_id = 'data-worker-client'
--   service_name = 'data-worker'
--   allowed_audiences = ['datahub', 'aihub']
CREATE TABLE IF NOT EXISTS service_clients (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NULL,

    client_id VARCHAR(150) NOT NULL,
    service_name VARCHAR(255) NOT NULL,

    secret_hash TEXT NOT NULL,
    secret_algorithm VARCHAR(100) NOT NULL DEFAULT 'bcrypt',

    allowed_audiences JSONB NOT NULL DEFAULT '[]'::jsonb,

    access_token_ttl_seconds INTEGER NOT NULL DEFAULT 3600,

    description TEXT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_service_clients_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT uq_service_clients_client_id
        UNIQUE (client_id)
);

-- 12. SERVICE CLIENT PERMISSIONS
-- Direct machine permissions.
--
-- Example:
--   data-worker-client -> datasource:ingest
--   agent-orchestrator-client -> model:invoke
CREATE TABLE IF NOT EXISTS service_client_permissions (
    service_client_id UUID NOT NULL,
    permission_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (service_client_id, permission_id),

    CONSTRAINT fk_service_client_permissions_client
        FOREIGN KEY (service_client_id) REFERENCES service_clients(id) ON DELETE CASCADE,

    CONSTRAINT fk_service_client_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 13. USER SESSIONS
-- User login session.
-- workspace_id is optional current workspace context.
--
-- Example:
--   Alice logged into ACME / Finance workspace.
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY NOT NULL,

    user_id UUID NOT NULL,
    tenant_id UUID NULL,
    workspace_id UUID NULL,

    session_token_hash TEXT NULL,

    auth_method VARCHAR(50) NOT NULL DEFAULT 'password',

    ip_address TEXT NULL,
    user_agent TEXT NULL,

    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    last_used_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CONSTRAINT fk_user_sessions_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT fk_user_sessions_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- 14. OAUTH SIGNING KEYS
-- JWT signing key metadata.
-- Public key can be exposed through JWKS endpoint.
-- Private key should be stored in KMS/Vault/secret manager when possible.
--
-- Example:
--   key_id = 'iam-rs256-2026-01'
--   algorithm = 'RS256'
CREATE TABLE IF NOT EXISTS oauth_signing_keys (
    id UUID PRIMARY KEY NOT NULL,

    key_id VARCHAR(255) NOT NULL UNIQUE,

    algorithm VARCHAR(50) NOT NULL DEFAULT 'RS256',

    public_jwk JSONB NOT NULL,
    encrypted_private_jwk TEXT NOT NULL,
    encryption_key_id VARCHAR(255) NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    not_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. FEATURES
-- Product capabilities.
--
-- Example:
--   datasource.ingestion
--   agent.runtime
--   model.invoke
CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY NOT NULL,

    key VARCHAR(150) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,

    description TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. FEATURE ENTITLEMENT
-- Tenant-level feature enablement.
--
-- Renamed from tenant_feature_entitlements to feature_entitlement.
--
-- Example:
--   tenant ACME has feature datasource.ingestion enabled.
CREATE TABLE IF NOT EXISTS feature_entitlement (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,
    feature_id UUID NOT NULL,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    config JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_feature_entitlement_tenant_feature
        UNIQUE (tenant_id, feature_id),

    CONSTRAINT fk_feature_entitlement_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT fk_feature_entitlement_feature
        FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);

-- 17. MODEL ENTITLEMENT
-- Tenant-level model access and model quota/budget.
--
-- This covers model-specific quota for now:
--   rpm_limit
--   tpm_limit
--   daily_token_limit
--   monthly_token_limit
--
-- AIHub should check this before calling model providers.
--
-- Example:
--   ACME can use openrouter:gpt-4.1 for chat with monthly limit 5,000,000 tokens.
CREATE TABLE IF NOT EXISTS model_entitlement (
    id UUID PRIMARY KEY NOT NULL,

    tenant_id UUID NOT NULL,

    model_key VARCHAR(150) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,

    allowed BOOLEAN NOT NULL DEFAULT TRUE,

    rpm_limit INTEGER NULL,
    tpm_limit INTEGER NULL,

    daily_token_limit BIGINT NULL,
    monthly_token_limit BIGINT NULL,

    config JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_model_entitlement_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT uq_model_entitlement_tenant_model_operation
        UNIQUE (tenant_id, model_key, operation_type)
);