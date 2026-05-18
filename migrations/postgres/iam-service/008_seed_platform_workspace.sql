-- V8: Seed a default workspace for the platform tenant.
--
-- V7 created the platform tenant + admin user + tenant membership but omitted
-- a workspace, which caused the login flow to stall: listWorkspaces returned an
-- empty list so the FE could never call switchContext to obtain a full access_token.
--
-- Creates:
--   1. A default workspace in the platform tenant
--   2. A workspace_membership linking the platform admin's tenant membership
--   3. A workspace_membership_role granting workspace_owner
--
-- UUIDs:
--   workspace           00000000-0000-0000-0005-000000000001
--   workspace_membership 00000000-0000-0000-0006-000000000001
--
-- All IDs from prior migrations referenced here:
--   tenant              00000000-0000-0000-0003-000000000001  (V7)
--   user                00000000-0000-0000-0002-000000000001  (V7)
--   membership          00000000-0000-0000-0004-000000000001  (V7)
--   workspace_owner role 00000000-0000-0000-0001-000000000003  (V4)
--
-- Migration is idempotent — ON CONFLICT … DO NOTHING on every statement.

-- ── 1. Default workspace ──────────────────────────────────────────────────────
INSERT INTO workspaces (id, tenant_id, code, name, description, status, created_by_user_id, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0005-000000000001'::uuid,
    '00000000-0000-0000-0003-000000000001'::uuid,
    'platform-default',
    'Platform Default',
    'Built-in workspace for the platform administrator.',
    'active',
    '00000000-0000-0000-0002-000000000001'::uuid,
    NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Workspace membership — platform admin in the default workspace ─────────
INSERT INTO workspace_memberships (id, tenant_id, workspace_id, membership_id, status, joined_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0006-000000000001'::uuid,
    '00000000-0000-0000-0003-000000000001'::uuid,
    '00000000-0000-0000-0005-000000000001'::uuid,
    '00000000-0000-0000-0004-000000000001'::uuid,
    'active',
    NOW(), NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Workspace membership role — grant workspace_owner ─────────────────────
INSERT INTO workspace_membership_roles (workspace_membership_id, role_id, created_at)
VALUES (
    '00000000-0000-0000-0006-000000000001'::uuid,
    '00000000-0000-0000-0001-000000000003'::uuid,
    NOW()
)
ON CONFLICT DO NOTHING;
