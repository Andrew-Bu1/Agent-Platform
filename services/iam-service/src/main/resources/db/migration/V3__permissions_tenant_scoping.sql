-- Scope permissions to a tenant so each tenant can define custom permission keys
-- without polluting the global namespace.
--
-- Platform permissions (tenant_id IS NULL, is_system = true) remain globally visible.
-- Tenant permissions (tenant_id = <uuid>, is_system = false) are only visible to their tenant.

ALTER TABLE permissions ADD COLUMN IF NOT EXISTS tenant_id UUID NULL;

ALTER TABLE permissions ADD CONSTRAINT fk_permissions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Drop the old global unique constraints (key was globally unique, no longer applies).
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_key_key;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS uq_permissions_resource_action;

-- Platform-level (tenant_id IS NULL): key and resource+action must be globally unique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_platform_key
    ON permissions (key) WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_platform_resource_action
    ON permissions (resource, action) WHERE tenant_id IS NULL;

-- Tenant-scoped (tenant_id IS NOT NULL): key and resource+action unique within that tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_tenant_key
    ON permissions (tenant_id, key) WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_tenant_resource_action
    ON permissions (tenant_id, resource, action) WHERE tenant_id IS NOT NULL;
