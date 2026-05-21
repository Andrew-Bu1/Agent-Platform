-- V11: Add missing flow:read permission.
--
-- FlowController gates every list/get endpoint on flow:read, but this
-- permission was never seeded — only flow:create/publish/run/update/delete
-- exist from V5 and V9. Any role that can see or run flows needs flow:read.

-- ── New permission ────────────────────────────────────────────────────────────
INSERT INTO permissions (id, key, resource, action, description, is_system, created_at)
VALUES (
    'a0000000-0000-0000-0003-000000000016',
    'flow:read', 'flow', 'read',
    'Read and list flows and flow versions',
    TRUE, NOW()
)
ON CONFLICT (key) WHERE tenant_id IS NULL DO NOTHING;

-- ── Role grants ───────────────────────────────────────────────────────────────
-- tenant_admin (0002): all permissions
-- workspace_owner (0003): all workspace ops
-- workspace_member (0004): can run flows — must be able to read them
-- agent_builder (0005): full flow CRUD already, add read
-- viewer (0006): can run flows — must be able to read them
INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM permissions p
    CROSS JOIN (
        SELECT id FROM roles
        WHERE id IN (
            '00000000-0000-0000-0001-000000000002',
            '00000000-0000-0000-0001-000000000003',
            '00000000-0000-0000-0001-000000000004',
            '00000000-0000-0000-0001-000000000005',
            '00000000-0000-0000-0001-000000000006'
        )
    ) r
    WHERE p.key = 'flow:read' AND p.tenant_id IS NULL
ON CONFLICT DO NOTHING;
