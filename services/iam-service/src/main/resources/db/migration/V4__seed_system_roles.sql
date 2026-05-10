-- Seed the three built-in system roles required by the bootstrap flow.
-- Uses fixed UUIDs so the migration is idempotent (ON CONFLICT (id) DO NOTHING).

INSERT INTO roles (id, key, name, scope_type, description, is_system, tenant_id, created_at, updated_at)
VALUES
    -- Platform-level: grants access to feature/entitlement management endpoints
    ('00000000-0000-0000-0001-000000000001'::uuid,
     'platform_admin', 'Platform Administrator', 'platform',
     'Full platform-level access including feature and entitlement management.',
     true, NULL, NOW(), NOW()),

    -- Tenant-level: grants access to tenant admin endpoints (members, roles, permissions, service clients)
    ('00000000-0000-0000-0001-000000000002'::uuid,
     'tenant_admin', 'Tenant Administrator', 'tenant',
     'Full administrative access within a tenant.',
     true, NULL, NOW(), NOW()),

    -- Workspace-level: full workspace control (assigned to the workspace creator)
    ('00000000-0000-0000-0001-000000000003'::uuid,
     'workspace_owner', 'Workspace Owner', 'workspace',
     'Full access within a workspace.',
     true, NULL, NOW(), NOW()),

    -- Workspace-level: standard member access
    ('00000000-0000-0000-0001-000000000004'::uuid,
     'workspace_member', 'Workspace Member', 'workspace',
     'Standard member access within a workspace.',
     true, NULL, NOW(), NOW())

ON CONFLICT (id) DO NOTHING;
