-- V9: Full permission matrix
--
-- Adds missing permissions and aligns every system role to the intended matrix:
--
--   platform_admin  (platform) → provider:manage, model:manage, model:read,
--                                  feature:manage, entitlement:manage
--   tenant_admin    (tenant)   → model:read + all resource CRUD across tenant
--                                  incl. role:manage, member:manage
--   workspace_owner (workspace)→ all workspace ops + member:manage
--   workspace_member(workspace)→ model:read/invoke, datasource:read/search,
--                                  agent:run, flow:run
--   agent_builder   (workspace)→ all resource ops, NO role:manage/member:manage
--   viewer          (workspace)→ model:read/invoke, read-only on everything

-- ── 1. New system permissions ─────────────────────────────────────────────────
-- Series: a0000000-0000-0000-0003-000000000NNN
INSERT INTO permissions (id, key, resource, action, description, is_system, created_at)
VALUES
    ('a0000000-0000-0000-0003-000000000001',
     'feature:manage',    'feature',    'manage',
     'Create, update, delete platform feature definitions',        TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000002',
     'entitlement:manage','entitlement','manage',
     'Grant/update/revoke model and feature entitlements per tenant', TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000003',
     'model:read',        'model',      'read',
     'Read and list model configurations',                          TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000004',
     'agent:delete',      'agent',      'delete',
     'Delete agents',                                               TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000005',
     'agent:read',        'agent',      'read',
     'Read and list agents',                                        TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000006',
     'tool:create',       'tool',       'create',
     'Create tools',                                                TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000007',
     'tool:update',       'tool',       'update',
     'Update tools',                                                TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000008',
     'tool:delete',       'tool',       'delete',
     'Delete tools',                                                TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000009',
     'tool:read',         'tool',       'read',
     'Read and list tools',                                         TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000010',
     'datasource:update', 'datasource', 'update',
     'Update data source configurations',                           TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000011',
     'datasource:delete', 'datasource', 'delete',
     'Delete data sources',                                         TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000012',
     'flow:update',       'flow',       'update',
     'Update flows',                                                TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000013',
     'flow:delete',       'flow',       'delete',
     'Delete flows',                                                TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000014',
     'role:manage',       'role',       'manage',
     'Create, update, delete roles and permission assignments within a tenant', TRUE, NOW()),

    ('a0000000-0000-0000-0003-000000000015',
     'member:manage',     'member',     'manage',
     'Invite and remove members from tenant and workspaces',        TRUE, NOW())

ON CONFLICT (key) WHERE tenant_id IS NULL DO NOTHING;

-- ── 2. platform_admin (id 0001) ───────────────────────────────────────────────
-- Already has provider:manage and model:manage from V6.
-- Add: feature:manage, entitlement:manage, model:read
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000001', id
    FROM permissions
    WHERE key IN ('feature:manage', 'entitlement:manage', 'model:read')
      AND tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- ── 3. tenant_admin (id 0002) ─────────────────────────────────────────────────
-- Has all 11 V5 permissions already.
-- Add all new V9 permissions EXCEPT platform-only ones
-- (feature:manage, entitlement:manage are platform-only; model:manage/provider:manage not granted here).
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000002', id
    FROM permissions
    WHERE key IN (
        'model:read',
        'agent:delete', 'agent:read',
        'tool:create', 'tool:update', 'tool:delete', 'tool:read',
        'datasource:update', 'datasource:delete',
        'flow:update', 'flow:delete',
        'role:manage', 'member:manage'
    )
      AND tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- ── 4. workspace_owner (id 0003) ──────────────────────────────────────────────
-- Has all 11 V5 permissions already.
-- Add workspace-scoped new permissions + member:manage (but NOT role:manage —
-- workspace owners manage workspace membership, not tenant-level roles).
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000003', id
    FROM permissions
    WHERE key IN (
        'model:read',
        'agent:delete', 'agent:read',
        'tool:create', 'tool:update', 'tool:delete', 'tool:read',
        'datasource:update', 'datasource:delete',
        'flow:update', 'flow:delete',
        'member:manage'
    )
      AND tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- ── 5. workspace_member (id 0004) ─────────────────────────────────────────────
-- Add model:read and agent:read, tool:read so members can browse the catalog.
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000004', id
    FROM permissions
    WHERE key IN ('model:read', 'agent:read', 'tool:read')
      AND tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- ── 6. agent_builder (id 0005) ────────────────────────────────────────────────
-- Currently has: model:invoke, datasource:read/search, agent:create/update/run,
--               flow:create/publish/run
-- Add: model:read, agent:delete/read, all tool ops,
--      datasource:update/delete, flow:update/delete
-- Intentionally NO role:manage, member:manage
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000005', id
    FROM permissions
    WHERE key IN (
        'model:read',
        'agent:delete', 'agent:read',
        'tool:create', 'tool:update', 'tool:delete', 'tool:read',
        'datasource:create', 'datasource:ingest',
        'datasource:update', 'datasource:delete',
        'flow:update', 'flow:delete'
    )
      AND tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- ── 7. viewer (id 0006) ───────────────────────────────────────────────────────
-- Currently has: model:invoke, datasource:read/search, agent:run, flow:run
-- Add: model:read, agent:read, tool:read (read-only catalog browsing)
INSERT INTO role_permissions (role_id, permission_id)
    SELECT '00000000-0000-0000-0001-000000000006', id
    FROM permissions
    WHERE key IN ('model:read', 'agent:read', 'tool:read')
      AND tenant_id IS NULL
ON CONFLICT DO NOTHING;
