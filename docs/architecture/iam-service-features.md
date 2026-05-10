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

### Workspace Members
```
GET    /tenants/{tenantId}/workspaces/{workspaceId}/members                              — list
POST   /tenants/{tenantId}/workspaces/{workspaceId}/members                              — invite  [tenant_admin]
DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}                     — remove  [tenant_admin]
POST   /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles               — assign role
DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}/roles/{roleKey}     — revoke role
```

---

## 5. Role Management (`/roles`)

Roles have a **scope type** that determines what they grant access to:

| Scope | System roles seeded | Assignable by |
|---|---|---|
| `platform` | `platform_admin` | — (system only) |
| `tenant` | `tenant_admin` | tenant admin |
| `workspace` | `workspace_owner`, `workspace_member`, `agent_builder`, `viewer` | tenant admin |

Tenant admins can also create **custom roles** scoped to `tenant` or `workspace`.

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

---

## Access Control Summary

| Actor | Can do |
|---|---|
| **Platform admin** | Manage features, grant/revoke entitlements for any tenant |
| **Tenant admin** | Manage their tenant's workspaces, members, custom roles, custom permissions, service clients |
| **Workspace owner** | Full control within a workspace (assigned on bootstrap/create) |
| **Workspace member** | Standard access within a workspace |
| **Service client** | M2M token via `client_credentials`; permissions explicitly assigned by tenant admin |

**Platform admin** = any user whose active membership includes a role with `scope_type = 'platform'`.  
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
Downstream services must validate `iss`, `aud`, `token_type`, and `exp`. They must **not** call IAM on every request — JWKS is cached locally and re-fetched only on unknown `kid` (key rotation).

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
