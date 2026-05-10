-- V6: Add platform-level permissions for provider and model-config management.
--
-- These endpoints are implemented in the AIHub service and must only be
-- accessible to platform administrators.  V5 did not seed any permissions for
-- the platform_admin role; this migration adds the two missing ones.

-- ── New system permissions ────────────────────────────────────────────────────
INSERT INTO permissions (id, key, resource, action, description, is_system, created_at)
VALUES
    ('a0000000-0000-0000-0002-000000000001',
     'provider:manage', 'provider', 'manage',
     'Create, update, delete AI providers and rotate API keys', TRUE, NOW()),

    ('a0000000-0000-0000-0002-000000000002',
     'model:manage', 'model', 'manage',
     'Create, update, delete model configurations',             TRUE, NOW())
ON CONFLICT (key) WHERE tenant_id IS NULL DO NOTHING;

-- ── Grant to platform_admin (id 0001) ─────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
VALUES
    ('00000000-0000-0000-0001-000000000001', 'a0000000-0000-0000-0002-000000000001'),
    ('00000000-0000-0000-0001-000000000001', 'a0000000-0000-0000-0002-000000000002')
ON CONFLICT DO NOTHING;
