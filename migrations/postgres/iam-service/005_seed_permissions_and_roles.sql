-- V5: Seed system permissions, role→permission grants, and additional workspace roles.
--
-- V4 seeded 4 system roles (platform_admin, tenant_admin, workspace_owner, workspace_member).
-- This migration adds:
--   - System permissions required by downstream services
--   - role_permissions linking tenant_admin and workspace_owner to all permissions
--   - agent_builder role (workspace-scoped, build + run)
--   - viewer role (workspace-scoped, read-only run)
--   - role_permissions for the two new roles

-- ── System permissions ────────────────────────────────────────────────────────
INSERT INTO permissions (id, key, resource, action, description, is_system, created_at)
VALUES
    ('a0000000-0000-0000-0001-000000000001', 'model:invoke',      'model',      'invoke',  'Invoke AI models',           TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000002', 'datasource:create', 'datasource', 'create',  'Create data sources',        TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000003', 'datasource:read',   'datasource', 'read',    'Read data sources',          TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000004', 'datasource:ingest', 'datasource', 'ingest',  'Ingest data',                TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000005', 'datasource:search', 'datasource', 'search',  'Search data sources',        TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000006', 'agent:create',      'agent',      'create',  'Create agents',              TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000007', 'agent:update',      'agent',      'update',  'Update agents',              TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000008', 'agent:run',         'agent',      'run',     'Run agents',                 TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000009', 'flow:create',       'flow',       'create',  'Create flows',               TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000010', 'flow:publish',      'flow',       'publish', 'Publish flows',              TRUE, NOW()),
    ('a0000000-0000-0000-0001-000000000011', 'flow:run',          'flow',       'run',     'Run flows',                  TRUE, NOW())
ON CONFLICT (key) WHERE tenant_id IS NULL DO NOTHING;

-- ── Additional workspace roles ────────────────────────────────────────────────
-- tenant_admin and workspace_owner already exist from V4 (UUIDs 0002 and 0003).
INSERT INTO roles (id, key, name, scope_type, description, is_system, tenant_id, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0001-000000000005',
     'agent_builder', 'Agent Builder', 'workspace',
     'Build, publish, and run agents and flows within a workspace.',
     TRUE, NULL, NOW(), NOW()),

    ('00000000-0000-0000-0001-000000000006',
     'viewer', 'Viewer', 'workspace',
     'Read-only access; can run but not create or modify agents and flows.',
     TRUE, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ── Role → permission grants ──────────────────────────────────────────────────
-- tenant_admin (0002): all permissions
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000002', id FROM permissions
ON CONFLICT DO NOTHING;

-- workspace_owner (0003): all permissions
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000003', id FROM permissions
ON CONFLICT DO NOTHING;

-- workspace_member (0004): invoke model, read/search datasources, run agent/flow
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000004', id FROM permissions
    WHERE key IN ('model:invoke', 'datasource:read', 'datasource:search', 'agent:run', 'flow:run')
ON CONFLICT DO NOTHING;

-- agent_builder (0005): invoke model, datasource read/search, full agent + flow CRUD
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000005', id FROM permissions
    WHERE key IN (
        'model:invoke',
        'datasource:read', 'datasource:search',
        'agent:create', 'agent:update', 'agent:run',
        'flow:create', 'flow:publish', 'flow:run'
    )
ON CONFLICT DO NOTHING;

-- viewer (0006): invoke model, read/search datasources, run agent/flow (no create/edit)
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000006', id FROM permissions
    WHERE key IN ('model:invoke', 'datasource:read', 'datasource:search', 'agent:run', 'flow:run')
ON CONFLICT DO NOTHING;
