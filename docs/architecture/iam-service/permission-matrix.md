# IAM Service — Role & Permission Matrix

## Scopes

| Scope | Meaning |
|---|---|
| `platform` | Applies across the entire platform (no tenant boundary) |
| `tenant` | Applies across all workspaces inside one tenant |
| `workspace` | Applies within a single workspace |

---

## System Roles

| Role key | Scope | Auto-assigned when |
|---|---|---|
| `platform_admin` | platform | Seeded manually; assigned via platform bootstrap |
| `tenant_admin` | tenant | Assigned when a user bootstraps or is promoted inside a tenant |
| `workspace_owner` | workspace | Auto-assigned to whoever creates a workspace |
| `workspace_member` | workspace | Auto-assigned to any user invited to a workspace |
| `agent_builder` | workspace | Explicitly assigned to users who build agents/flows |
| `viewer` | workspace | Explicitly assigned for read-only access |

---

## Full Permission Catalogue

### Platform permissions (NULL tenant_id — platform-wide)

| Key | Resource | Action | Description |
|---|---|---|---|
| `provider:manage` | provider | manage | Create, update, delete AI providers and rotate API keys |
| `model:manage` | model | manage | Create, update, delete model configurations |
| `model:read` | model | read | Read and list model configurations |
| `feature:manage` | feature | manage | Create, update, delete platform feature definitions |
| `entitlement:manage` | entitlement | manage | Grant/update/revoke model and feature entitlements per tenant |

### Resource permissions (shared across tenant & workspace scopes)

| Key | Resource | Action | Description |
|---|---|---|---|
| `model:invoke` | model | invoke | Invoke AI models |
| `datasource:create` | datasource | create | Create data sources |
| `datasource:read` | datasource | read | Read data sources |
| `datasource:ingest` | datasource | ingest | Ingest data into a data source |
| `datasource:search` | datasource | search | Search data sources |
| `datasource:update` | datasource | update | Update data source configurations |
| `datasource:delete` | datasource | delete | Delete data sources |
| `agent:create` | agent | create | Create agents |
| `agent:update` | agent | update | Update agents |
| `agent:delete` | agent | delete | Delete agents |
| `agent:read` | agent | read | Read and list agents |
| `agent:run` | agent | run | Run agents |
| `tool:create` | tool | create | Create tools |
| `tool:update` | tool | update | Update tools |
| `tool:delete` | tool | delete | Delete tools |
| `tool:read` | tool | read | Read and list tools |
| `flow:create` | flow | create | Create flows |
| `flow:update` | flow | update | Update flows |
| `flow:publish` | flow | publish | Publish flows |
| `flow:delete` | flow | delete | Delete flows |
| `flow:run` | flow | run | Run flows |

### Administrative permissions

| Key | Resource | Action | Description |
|---|---|---|---|
| `role:manage` | role | manage | Create, update, delete roles and permission assignments within a tenant |
| `member:manage` | member | manage | Invite and remove members from tenant and workspaces |

---

## Role → Permission Matrix

`✓` = granted &nbsp; `—` = not granted

| Permission | platform_admin | tenant_admin | workspace_owner | workspace_member | agent_builder | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `provider:manage` | ✓ | — | — | — | — | — |
| `model:manage` | ✓ | — | — | — | — | — |
| `model:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `feature:manage` | ✓ | — | — | — | — | — |
| `entitlement:manage` | ✓ | — | — | — | — | — |
| `model:invoke` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `datasource:create` | — | ✓ | ✓ | — | ✓ | — |
| `datasource:read` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `datasource:ingest` | — | ✓ | ✓ | — | ✓ | — |
| `datasource:search` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `datasource:update` | — | ✓ | ✓ | — | ✓ | — |
| `datasource:delete` | — | ✓ | ✓ | — | — | — |
| `agent:create` | — | ✓ | ✓ | — | ✓ | — |
| `agent:update` | — | ✓ | ✓ | — | ✓ | — |
| `agent:delete` | — | ✓ | ✓ | — | ✓ | — |
| `agent:read` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `agent:run` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tool:create` | — | ✓ | ✓ | — | ✓ | — |
| `tool:update` | — | ✓ | ✓ | — | ✓ | — |
| `tool:delete` | — | ✓ | ✓ | — | ✓ | — |
| `tool:read` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `flow:create` | — | ✓ | ✓ | — | ✓ | — |
| `flow:update` | — | ✓ | ✓ | — | ✓ | — |
| `flow:publish` | — | ✓ | ✓ | — | ✓ | — |
| `flow:delete` | — | ✓ | ✓ | — | ✓ | — |
| `flow:run` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `role:manage` | — | ✓ | — | — | — | — |
| `member:manage` | — | ✓ | ✓ | — | — | — |

---

## Design Rationale

### Why `workspace_owner` does not have `role:manage`
Role management is a **tenant-level** concern — adding, editing, or deleting role definitions affects all workspaces under the tenant. `workspace_owner` has authority over membership within their workspace (`member:manage`) but cannot change the role catalogue itself.

### Why `agent_builder` does not have `datasource:delete`
Builders create and update data sources to feed their agents, but destructive deletion of a shared data source can break other agents in the workspace. Only `tenant_admin` and `workspace_owner` can delete data sources.

### Why `platform_admin` does not have resource permissions (agent, flow, etc.)
`platform_admin` is a cross-tenant operator role. It manages infrastructure (providers, models, features, entitlements, tenants) but does not operate inside any tenant's workspace. Separating these scopes prevents privilege escalation across tenant boundaries.

### `workspace_member` vs `viewer`
Both have identical effective permissions in this matrix. The distinction is **intent**:
- `workspace_member` is the **default role** auto-assigned on invite; it can be upgraded to `agent_builder`.
- `viewer` is an **explicit opt-in** for stakeholders who should never accidentally be promoted to builder rights.

---

## Migration History

| Migration | Changes |
|---|---|
| V5 | Seeded 11 base permissions; granted all to `tenant_admin` + `workspace_owner`; added `agent_builder` and `viewer` roles |
| V6 | Added `provider:manage` + `model:manage`; granted to `platform_admin` only |
| V9 | Added 15 new permissions (see catalogue above); aligned all 6 system roles to this matrix |
