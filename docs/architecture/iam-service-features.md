# IAM Service — Features & API Reference

Base URL: `http://iam-service:8080`  
Auth: Bearer JWT (RS256) on all endpoints unless noted as **public**.

---

## 1. Authentication (`/auth`)

### Sign Up
```
POST /auth/signup  [public]
```
Creates a new user account. Returns `userId`, `email`, `name`.  
New users have no tenant on first login — they must bootstrap or join one.

### Login
```
POST /auth/login  [public]
```
Validates email + password. Returns a short-lived **pre-auth token** plus context hints:

| Field | Meaning |
|---|---|
| `requireTenantCreation` | `true` → user has no tenant yet; call `/tenants/bootstrap` |
| `requireTenantSelection` | `true` → user belongs to multiple tenants; pick one |
| `singleTenantId` | set when user belongs to exactly one tenant |
| `tenants` | list of the user's tenants |

### List Workspaces for a Tenant
```
POST /auth/workspaces  [pre-auth token]
```
Given a `preAuthToken` + `tenantId`, returns the available workspaces.

### Switch Context (get full JWT)
```
POST /auth/switch-context  [pre-auth token]
```
Accepts `preAuthToken` + `tenantId` + `workspaceId`.  
Issues **access token** (JWT RS256) + **refresh token** bound to that tenant/workspace context.

### Switch Context (authenticated — already logged in)
```
POST /auth/switch  [authenticated]
```
Accepts `tenantId` + `workspaceId` body while the caller already holds a valid access token.  
Re-evaluates permissions for the new context and issues a new access + refresh token pair.  
Use this when the user switches tenant/workspace without going through the pre-auth flow again.

### Refresh Tokens
```
POST /auth/refresh  [public — takes refresh token]
```
Rotates the refresh token and returns a new access + refresh pair.

### Logout
```
POST /auth/logout           [authenticated] — revoke ALL sessions
POST /auth/logout/session   [authenticated] — revoke current session only
```

### Me / Profile
```
GET   /auth/me                  [authenticated]
PATCH /auth/me/password         [authenticated]
```
Returns the caller's `userId`, `email`, `name`, `avatarUrl`, current `tenantId`, `workspaceId`.  
Password change requires `currentPassword` + `newPassword`.

---

## 2. OAuth2 Machine-to-Machine

### Service Client Token
```
POST /oauth/token  [public — form-encoded]
  grant_type=client_credentials
  client_id=<id>
  client_secret=<secret>
```
Returns a Bearer access token for the service client (M2M).  
Only `client_credentials` grant is supported.

### JWKS
```
GET /.well-known/jwks.json  [public]
```
Returns the RSA public key set used by all services to verify JWT signatures.

---

## 3. Tenant & Workspace Management (`/tenants`)

### Bootstrap — First Tenant (new user flow)
```
POST /tenants/bootstrap  [pre-auth token]
```
Creates the user's first **Tenant** + first **Workspace**.  
Automatically assigns `tenant_admin` role at tenant level and `workspace_owner` role at workspace level.  
Returns full access + refresh tokens so the client is immediately logged in.

### Tenants
```
GET    /tenants                  — list tenants the caller belongs to
POST   /tenants                  — create additional tenant (any authenticated user)
GET    /tenants/{tenantId}       — get tenant details
PATCH  /tenants/{tenantId}       — update tenant name  [tenant_admin]
DELETE /tenants/{tenantId}       — deactivate tenant   [tenant_admin]
```

### Workspaces
```
GET    /tenants/{tenantId}/workspaces                          — list workspaces
POST   /tenants/{tenantId}/workspaces                          — create workspace  [tenant_admin]
GET    /tenants/{tenantId}/workspaces/{workspaceId}            — get workspace
PATCH  /tenants/{tenantId}/workspaces/{workspaceId}            — update name/description  [tenant_admin]
DELETE /tenants/{tenantId}/workspaces/{workspaceId}            — deactivate workspace  [tenant_admin]
```

---

## 4. Member Management (`/tenants/{tenantId}/members`)

### Tenant Members
```
GET    /tenants/{tenantId}/members                         — list members + their roles
POST   /tenants/{tenantId}/members                         — invite user by email  [tenant_admin]
DELETE /tenants/{tenantId}/members/{userId}                — remove member  [tenant_admin]
POST   /tenants/{tenantId}/members/{userId}/roles          — assign role by key  [tenant_admin]
DELETE /tenants/{tenantId}/members/{userId}/roles/{roleKey} — revoke role  [tenant_admin]
```

Invite body: `{ email, roleKey }`. The target user must already exist. Tenant member responses include `membershipId`, `userId`, `email`, `name`, `joinedAt`, and `roles`.

### Workspace Members
```
GET    /tenants/{tenantId}/workspaces/{workspaceId}/members                              — list
POST   /tenants/{tenantId}/workspaces/{workspaceId}/members                              — invite existing tenant member by email  [tenant_admin]
DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}                     — remove  [tenant_admin]
POST   /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles               — assign role  [tenant_admin]
DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles/{roleKey}     — revoke role  [tenant_admin]
```

Workspace invite body: `{ email, roleKey }`. The user must already be an active tenant member. Workspace member responses include `workspaceMembershipId`, `userId`, `email`, `name`, `joinedAt`, and `roles`.

---

## 5. Role Management (`/roles`)

Roles have a **scope type** that determines what they grant access to:

| Scope | System roles seeded | Assignable by |
|---|---|---|
| `platform` | `platform_admin` | — (system only) |
| `tenant` | `tenant_admin` | tenant admin |
| `workspace` | `workspace_owner`, `workspace_member`, `agent_builder`, `viewer` | tenant admin |

Tenant admins can also create **custom roles** scoped to `tenant` or `workspace`.
Custom role keys must not collide with either platform roles visible to the tenant or existing tenant-owned roles.

```
GET    /roles                              — list roles visible to caller's tenant
GET    /roles/{roleId}                     — get role details
POST   /roles                             — create custom role  [tenant_admin]
PATCH  /roles/{roleId}                    — update name/description  [tenant_admin, custom roles only]
DELETE /roles/{roleId}                    — delete role  [tenant_admin, custom roles only]
```

System roles (`is_system = true`) cannot be modified or deleted.

### Role ↔ Permission
```
GET    /roles/{roleId}/permissions                  — list permissions assigned to role
POST   /roles/{roleId}/permissions                  — assign permission  [tenant_admin]
DELETE /roles/{roleId}/permissions/{permissionId}   — revoke permission  [tenant_admin]
```

Only permissions visible to the tenant (platform-level or tenant's own) may be assigned.

---

## 6. Permission Management (`/permissions`)

Permissions have a **tenant scope**:

| `tenant_id` | Visibility |
|---|---|
| `NULL` | Platform-wide — visible to all tenants (system permissions) |
| `UUID` | Tenant-scoped — visible only to that tenant |

```
GET  /permissions/me        — returns caller's effective permissions from JWT (no DB hit)
GET  /permissions           — list platform permissions + caller's tenant's own permissions
GET  /permissions/{id}      — get single permission (must be visible to caller's tenant)
POST /permissions           — create custom permission  [tenant_admin]
PATCH /permissions/{id}     — update description  [tenant_admin, tenant-owned only]
DELETE /permissions/{id}    — delete permission  [tenant_admin, tenant-owned only, not in use]
```

Platform/system permissions (`tenant_id IS NULL` or `is_system = true`) cannot be modified or deleted by tenant admins.  
Deletion is blocked if the permission is still assigned to any role or service client.

---

## 7. Service Clients — M2M OAuth (`/service-clients`)

Service clients represent machine-to-machine integrations (e.g., Agent Orchestrator, Data Worker). Each client has a `client_id` + bcrypt-hashed secret.

```
GET    /service-clients                         — list service clients  [active member]
GET    /service-clients/{id}                    — get client details  [active member]
POST   /service-clients                         — create client  [tenant_admin] → returns plain secret ONCE
PATCH  /service-clients/{id}                    — update name/description/audiences/ttl  [tenant_admin]
POST   /service-clients/{id}/rotate-secret      — rotate secret  [tenant_admin] → returns new plain secret
PATCH  /service-clients/{id}/activate           — re-enable client  [tenant_admin]
PATCH  /service-clients/{id}/deactivate         — disable client  [tenant_admin]
DELETE /service-clients/{id}                    — delete client  [tenant_admin]
```

**Note:** the plain `clientSecret` is returned only on create and rotate — it is never stored.

### Service Client ↔ Permission
```
GET    /service-clients/{id}/permissions                    — list assigned permissions  [active member]
POST   /service-clients/{id}/permissions                    — assign permission  [tenant_admin]
DELETE /service-clients/{id}/permissions/{permissionId}     — revoke permission  [tenant_admin]
```

---

## 8. Feature Management (`/features`)

Features are platform-wide capability flags (e.g., `agent_studio`, `data_hub`).

```
GET    /features        [public — authenticated]  — list all features
GET    /features/{id}   [public — authenticated]  — get feature
POST   /features        [platform_admin]           — create feature
PATCH  /features/{id}   [platform_admin]           — update name/description
DELETE /features/{id}   [platform_admin]           — delete feature
```

Only users whose active membership includes a role with `scope_type = 'platform'` can write features.

---

## 9. Entitlement Management (`/entitlements`)

Entitlements grant a **tenant** access to a feature or AI model. Managed exclusively by platform admins.

### Feature Entitlements
```
GET    /entitlements/features          — caller's tenant feature entitlements (summary view)
GET    /entitlements/features/all      — full entitlement records for caller's tenant
POST   /entitlements/features          — grant feature to tenant  [platform_admin]
PATCH  /entitlements/features/{id}     — enable/disable or update config  [platform_admin]
DELETE /entitlements/features/{id}     — revoke feature from tenant  [platform_admin]
```

### Model Entitlements
```
GET    /entitlements/models            — caller's tenant model entitlements (summary view)
GET    /entitlements/models/all        — full entitlement records
POST   /entitlements/models            — grant model access  [platform_admin]
PATCH  /entitlements/models/{id}       — update rate limits (rpm/tpm/daily/monthly)  [platform_admin]
DELETE /entitlements/models/{id}       — revoke model access  [platform_admin]
```

Model entitlements include rate-limit fields: `rpmLimit`, `tpmLimit`, `dailyTokenLimit`, `monthlyTokenLimit`.

**Note:** `/entitlements/*` always operates on the tenant bound to the caller's current JWT. For cross-tenant management use the `/platform/*` endpoints below.

---

## 10. Platform Admin API (`/platform`)

These endpoints allow a **platform admin** to inspect and manage any tenant's data, regardless of the caller's own tenant context.

### Tenant & Workspace Listing
```
GET  /platform/tenants                              — list all tenants on the platform  [platform_admin]
GET  /platform/tenants/{tenantId}/workspaces        — list workspaces for any tenant    [platform_admin]
```

> **Note:** The internal `platform` anchor tenant (`plan_key = 'platform'`) that holds the platform admin
> account itself is **excluded** from the tenant listing. It is an implementation detail and should not
> appear in admin UIs.

### Cross-Tenant Entitlements
```
GET    /platform/tenants/{tenantId}/entitlements/features          — list feature entitlements for any tenant  [platform_admin]
GET    /platform/tenants/{tenantId}/entitlements/features/all      — full feature entitlement records          [platform_admin]
POST   /platform/tenants/{tenantId}/entitlements/features          — grant feature                             [platform_admin]
PATCH  /platform/tenants/{tenantId}/entitlements/features/{id}     — enable/disable or update config          [platform_admin]
DELETE /platform/tenants/{tenantId}/entitlements/features/{id}     — revoke feature                           [platform_admin]

GET    /platform/tenants/{tenantId}/entitlements/models            — list model entitlements for any tenant   [platform_admin]
GET    /platform/tenants/{tenantId}/entitlements/models/all        — full model entitlement records           [platform_admin]
POST   /platform/tenants/{tenantId}/entitlements/models            — grant model access                       [platform_admin]
PATCH  /platform/tenants/{tenantId}/entitlements/models/{id}       — update rate limits                       [platform_admin]
DELETE /platform/tenants/{tenantId}/entitlements/models/{id}       — revoke model access                      [platform_admin]
```

### Cross-Tenant Roles & Permissions (read-only)

These endpoints let a platform admin inspect **any tenant's role and permission configuration** without
being a member of that tenant.

```
GET  /platform/tenants/{tenantId}/roles        — list platform system roles + tenant's custom roles        [platform_admin]
GET  /platform/tenants/{tenantId}/permissions  — list platform system permissions + tenant's custom ones   [platform_admin]
```

Both endpoints return the same records that `GET /roles` and `GET /permissions` would return to a member
of that tenant — i.e. platform-level entries (`tenant_id IS NULL`) plus the tenant's own entries.
They are **read-only**: creating, updating, or deleting roles/permissions in another tenant's namespace
must still be done by a `tenant_admin` of that tenant.

All `/platform/*` endpoints require the caller's JWT to contain a role with `scope_type = 'platform'` (i.e. `platform_admin`). The bootstrap admin account seeded by V7 (`admin@platform.dev`) holds this role.

---

## Access Control Summary

| Actor | Can do |
|---|---|
| **Platform admin** | Manage features, grant/revoke entitlements for any tenant; **also has full `tenant_admin` rights within their own platform tenant** |
| **Tenant admin** | Manage their tenant's workspaces, members, custom roles, custom permissions, service clients |
| **Workspace owner** | Full control within a workspace (assigned on bootstrap/create) |
| **Workspace member** | Standard access within a workspace |
| **Service client** | M2M token via `client_credentials`; permissions explicitly assigned by tenant admin |

**Platform admin** = any user whose active membership includes a role with `scope_type = 'platform'`.  
`requireTenantAdmin` accepts either `platform_admin` or `tenant_admin` role — platform admin can therefore
manage members, roles, workspaces, and service clients within the platform tenant without needing a
separate `tenant_admin` role assignment.  
System roles seeded at DB init: `platform_admin`, `tenant_admin`, `workspace_owner`, `workspace_member`.

---

## JWT Token Contents

Access tokens (RS256) carry:

| Claim | User token | Service-client token | Description |
|---|---|---|---|
| `sub` | user UUID | `client_id` string | Subject |
| `iss` | `iam-service` | `iam-service` | Issuer — validated by all downstream services |
| `aud` | `["studio","datahub","aihub"]` | client's `allowedAudiences` | Audience — downstream services reject tokens where `aud` does not include their own key |
| `token_type` | `access` | `access` | Must be `access`; refresh tokens carry `refresh` and are never accepted by downstream services |
| `type` | `user` | `service_client` | Caller identity type |
| `tenant_id` | tenant UUID | tenant UUID (if set) | Active tenant context |
| `workspace_id` | workspace UUID | — (absent) | Active workspace context (user tokens only) |
| `user_id` | user UUID | — (absent) | Redundant copy of `sub` for user tokens |
| `client_id` | — (absent) | `client_id` string | Redundant copy of `sub` for service-client tokens |
| `permissions` | `["agent:run", ...]` | `["datasource:ingest", ...]` | Effective permission keys embedded at issuance |
| `exp` | Unix timestamp | Unix timestamp | Expiration |

Tokens are verified by downstream services using the public key from `/.well-known/jwks.json`.  
Downstream services must validate `iss`, `aud`, `token_type`, and `exp`. They must **not** call IAM on every request — JWKS is cached locally (keyed by `kid`) and re-fetched only when an unknown `kid` is encountered (transparent key rotation). Re-fetches are rate-limited to at most once per 60 seconds per service instance to prevent a DoS on the IAM JWKS endpoint via tokens with random key IDs.

---

## Login / Token Flow (step-by-step)

```
1. POST /auth/signup                       → userId
2. POST /auth/login                        → preAuthToken + context hints
3a. [New user]  POST /tenants/bootstrap    → access_token + refresh_token
3b. [Existing]  POST /auth/workspaces      → workspace list
                POST /auth/switch-context  → access_token + refresh_token
4. API calls with  Authorization: Bearer <access_token>
5. POST /auth/refresh                      → new access_token + refresh_token
6. POST /auth/logout                       → revoke all sessions
```

---

## Seeded System Permissions Reference

29 platform-wide (`tenant_id IS NULL`) permissions are seeded across migrations V5, V6, V9, and V11.  
All are `is_system = true` and cannot be modified or deleted by tenant admins.

### Permissions by resource

| Key | Resource | Action | Description | Migration |
|---|---|---|---|---|
| `model:invoke` | model | invoke | Invoke AI models | V5 |
| `model:read` | model | read | Read and list model configurations | V9 |
| `model:manage` | model | manage | Create, update, delete model configurations | V6 |
| `provider:manage` | provider | manage | Create, update, delete AI providers and rotate API keys | V6 |
| `feature:manage` | feature | manage | Create, update, delete platform feature definitions | V9 |
| `entitlement:manage` | entitlement | manage | Grant/update/revoke model and feature entitlements per tenant | V9 |
| `datasource:create` | datasource | create | Create data sources | V5 |
| `datasource:read` | datasource | read | Read data sources | V5 |
| `datasource:update` | datasource | update | Update data source configurations | V9 |
| `datasource:delete` | datasource | delete | Delete data sources | V9 |
| `datasource:ingest` | datasource | ingest | Ingest data | V5 |
| `datasource:search` | datasource | search | Search data sources | V5 |
| `agent:create` | agent | create | Create agents | V5 |
| `agent:read` | agent | read | Read and list agents | V9 |
| `agent:update` | agent | update | Update agents | V5 |
| `agent:delete` | agent | delete | Delete agents | V9 |
| `agent:run` | agent | run | Run agents | V5 |
| `tool:create` | tool | create | Create tools | V9 |
| `tool:read` | tool | read | Read and list tools | V9 |
| `tool:update` | tool | update | Update tools | V9 |
| `tool:delete` | tool | delete | Delete tools | V9 |
| `flow:create` | flow | create | Create flows | V5 |
| `flow:read` | flow | read | Read and list flows and flow versions | V11 |
| `flow:update` | flow | update | Update flows | V9 |
| `flow:delete` | flow | delete | Delete flows | V9 |
| `flow:publish` | flow | publish | Publish flows | V5 |
| `flow:run` | flow | run | Run flows | V5 |
| `role:manage` | role | manage | Create, update, delete roles and permission assignments within a tenant | V9 |
| `member:manage` | member | manage | Invite and remove members from tenant and workspaces | V9 |

### Role → permission matrix

`✓` = granted by system seed migrations. Tenant admins may further assign or revoke permissions on custom roles.

| Permission | `platform_admin` | `tenant_admin` | `workspace_owner` | `agent_builder` | `workspace_member` | `viewer` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `provider:manage` | ✓ | | | | | |
| `model:manage` | ✓ | | | | | |
| `feature:manage` | ✓ | | | | | |
| `entitlement:manage` | ✓ | | | | | |
| `model:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `model:invoke` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `datasource:create` | | ✓ | ✓ | ✓ | | |
| `datasource:read` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `datasource:update` | | ✓ | ✓ | ✓ | | |
| `datasource:delete` | | ✓ | ✓ | ✓ | | |
| `datasource:ingest` | | ✓ | ✓ | ✓ | | |
| `datasource:search` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `agent:create` | | ✓ | ✓ | ✓ | | |
| `agent:read` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `agent:update` | | ✓ | ✓ | ✓ | | |
| `agent:delete` | | ✓ | ✓ | ✓ | | |
| `agent:run` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tool:create` | | ✓ | ✓ | ✓ | | |
| `tool:read` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tool:update` | | ✓ | ✓ | ✓ | | |
| `tool:delete` | | ✓ | ✓ | ✓ | | |
| `flow:create` | | ✓ | ✓ | ✓ | | |
| `flow:read` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `flow:update` | | ✓ | ✓ | ✓ | | |
| `flow:delete` | | ✓ | ✓ | ✓ | | |
| `flow:publish` | | ✓ | ✓ | ✓ | | |
| `flow:run` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `role:manage` | | ✓ | | | | |
| `member:manage` | | ✓ | ✓ | | | |

**Notes:**
- `platform_admin` is a **platform-scoped** role. It does not grant workspace-level resource permissions (invoke, CRUD, run). A platform admin who also needs to use workspace features must hold a workspace role in addition.
- `role:manage` is granted only to `tenant_admin`. Workspace owners manage workspace membership but do not manage tenant-level role/permission definitions.
- `tenant_admin` inherits all workspace-level permissions in addition to tenant management permissions.

---

## Seeded Features Reference

9 platform features are seeded across migrations V10 and V12.  
Features are enabled per-tenant via `feature_entitlement` records (managed by platform admins).  
Downstream services use `FeatureGuard.require(tenantId, token, key)` to gate endpoints.

| Key | Name | Description | Enforced by | Migration |
|---|---|---|---|---|
| `agent_studio.flows` | Flow Builder | Create, edit, and run multi-agent flows in Agent Studio | agent-studio (Java) | V10 |
| `agent_studio.agents` | Agent Management | Create and manage AI agents in Agent Studio | agent-studio (Java) | V10 |
| `agent_studio.tools` | Tool Management | Create and manage tools (HTTP and code) in Agent Studio | agent-studio (Java) | V10 |
| `datahub.datasources` | DataHub Datasources | Create and manage datasources in DataHub | datahub (Go) | V10 |
| `datahub.ingestion` | DataHub Ingestion | Trigger document ingestion and embedding pipelines | datahub (Go) | V10 |
| `datahub.search` | DataHub Semantic Search | Run semantic vector search over ingested knowledge | datahub (Go) | V10 |
| `aihub.chat` | AIHub Chat Completions | Call LLM chat completions via AIHub | aihub (Python) | V10 |
| `aihub.embedding` | AIHub Embeddings | Generate text embeddings via AIHub | aihub (Python) | V10 |
| `aihub.rerank` | AIHub Rerank | Rerank candidate passages by relevance score via AIHub | aihub (Python) | V12 |
