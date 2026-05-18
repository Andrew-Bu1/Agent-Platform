-- V7: Seed the built-in platform administrator account.
--
-- Creates:
--   1. A platform "super-tenant" (tenant_id IS NULL scope anchor)
--   2. The platform admin user  — admin@platform.dev  /  Admin@1234
--   3. A membership linking the user to the platform tenant
--   4. A membership_role granting platform_admin (seeded in V4)
--
-- Password hash (bcrypt, cost 12):
--   Admin@1234  →  $2b$12$186Ao5vCwI2f7MPe3bjIZ.sjAmkpMV/1iO8yQ33Awm50Qh/f.5tgm
--
-- All UUIDs use the reserved prefix 00000000-0000-0000-000N-… so they are
-- easily identifiable and never collide with application-generated v4 UUIDs.
--
-- Migration is idempotent — ON CONFLICT … DO NOTHING on every statement.

-- ── 1. Platform anchor tenant ─────────────────────────────────────────────────
INSERT INTO tenants (id, code, name, status, plan_key, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0003-000000000001'::uuid,
    'platform',
    'Platform',
    'active',
    'platform',
    NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Platform admin user ────────────────────────────────────────────────────
INSERT INTO users (id, email, name, password_hash, password_algorithm, email_verified, status, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0002-000000000001'::uuid,
    'admin@platform.dev',
    'Platform Admin',
    '$2b$12$186Ao5vCwI2f7MPe3bjIZ.sjAmkpMV/1iO8yQ33Awm50Qh/f.5tgm',
    'bcrypt',
    TRUE,
    'active',
    NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Membership — user belongs to the platform tenant ──────────────────────
INSERT INTO memberships (id, tenant_id, user_id, status, joined_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0004-000000000001'::uuid,
    '00000000-0000-0000-0003-000000000001'::uuid,
    '00000000-0000-0000-0002-000000000001'::uuid,
    'active',
    NOW(), NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Membership role — grant platform_admin ────────────────────────────────
-- platform_admin role id is '00000000-0000-0000-0001-000000000001' (seeded in V4)
INSERT INTO membership_roles (membership_id, role_id, created_at)
VALUES (
    '00000000-0000-0000-0004-000000000001'::uuid,
    '00000000-0000-0000-0001-000000000001'::uuid,
    NOW()
)
ON CONFLICT DO NOTHING;
