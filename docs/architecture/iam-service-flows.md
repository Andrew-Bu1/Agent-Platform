# IAM Service — Detailed Flows

Each flow is written as a numbered step sequence. DB operations are noted where they matter for understanding the logic.

---

## Table of Contents

1. [Sign Up](#1-sign-up)
2. [Login](#2-login)
3. [Bootstrap — First Tenant (New User)](#3-bootstrap--first-tenant-new-user)
4. [Switch Context — Get Full JWT](#4-switch-context--get-full-jwt)
5. [Token Refresh](#5-token-refresh)
6. [Logout](#6-logout)
7. [Change Password](#7-change-password)
8. [M2M OAuth — client_credentials](#8-m2m-oauth--client_credentials)
9. [Create Additional Tenant (Existing User)](#9-create-additional-tenant-existing-user)
10. [Create Workspace](#10-create-workspace)
11. [Invite User to Tenant](#11-invite-user-to-tenant)
12. [Remove Member from Tenant](#12-remove-member-from-tenant)
13. [Invite User to Workspace](#13-invite-user-to-workspace)
14. [Remove Member from Workspace](#14-remove-member-from-workspace)
15. [Tenant Role Management](#15-tenant-role-management)
16. [Workspace Role Management](#16-workspace-role-management)
17. [Custom Role CRUD](#17-custom-role-crud)
18. [Assign / Revoke Permission on Role](#18-assign--revoke-permission-on-role)
19. [Custom Permission CRUD](#19-custom-permission-crud)
20. [Service Client Lifecycle](#20-service-client-lifecycle)
21. [Assign / Revoke Permission on Service Client](#21-assign--revoke-permission-on-service-client)
22. [Feature Management (Platform Admin)](#22-feature-management-platform-admin)
23. [Entitlement Management (Platform Admin)](#23-entitlement-management-platform-admin)
24. [How Effective Permissions Are Computed](#24-how-effective-permissions-are-computed)
25. [Platform Admin — Cross-Tenant Roles & Permissions](#25-platform-admin--cross-tenant-roles--permissions)

---

## 1. Sign Up

**Endpoint:** `POST /auth/signup`  
**Auth:** public

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- POST /auth/signup ------------>|                           |
  |   { name, email, password }      |                           |
  |                                  |-- existsByEmail? -------->|
  |                                  |<-- false -----------------| (conflict if true → 409)
  |                                  |                           |
  |                                  |-- hash password           |
  |                                  |-- INSERT iam_users ------>|
  |                                  |<-- userId ----------------| 
  |                                  |                           |
  |<-- 201 { userId, email, name } --|
```

**Guards:**
- Email uniqueness checked before insert → `409 CONFLICT` if taken.

**Next step:** Call `POST /auth/login` to get a pre-auth token.

---

## 2. Login

**Endpoint:** `POST /auth/login`  
**Auth:** public

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- POST /auth/login ------------->|                           |
  |   { email, password }            |                           |
  |                                  |-- findByEmail ----------->|
  |                                  |<-- user ------------------|
  |                                  |                           |
  |                                  |-- check status = active   |
  |                                  |-- BCrypt verify password  |
  |                                  |                           |
  |                                  |-- findMemberships(active)->|
  |                                  |<-- memberships -----------|
  |                                  |                           |
  |                                  |-- issue preAuthToken (JWT, token_type=pre_auth)
  |                                  |                           |
  |<-- 200 { preAuthToken, ... } ----|
```

**Three response branches based on membership count:**

| Condition | `requireTenantCreation` | `requireTenantSelection` | `singleTenantId` | `tenants` |
|---|---|---|---|---|
| No active memberships | `true` | `false` | null | null |
| Exactly 1 membership | `false` | `false` | tenantId | null |
| 2+ memberships | `false` | `true` | null | list |

**Client routing after login:**
- `requireTenantCreation = true` → call `POST /tenants/bootstrap`
- `requireTenantSelection = true` → show tenant picker, then `POST /auth/workspaces` + `POST /auth/switch-context`
- `singleTenantId` set → call `POST /auth/workspaces` + `POST /auth/switch-context`

**Guards:**
- `401` if email not found, password wrong, or user status ≠ `active`.

---

## 3. Bootstrap — First Tenant (New User)

**Endpoint:** `POST /tenants/bootstrap`  
**Auth:** pre-auth token  
**Trigger:** `requireTenantCreation = true` from login

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- POST /tenants/bootstrap ------>|                           |
  |   { preAuthToken,                |                           |
  |     tenantCode, tenantName,      |                           |
  |     workspaceCode, workspaceName }                           |
  |                                  |-- verify preAuthToken     |
  |                                  |   (token_type = pre_auth) |
  |                                  |-- extract userId          |
  |                                  |                           |
  |                                  |-- existsByCode(tenantCode)?->|
  |                                  |<-- false -----------------| (conflict → 409)
  |                                  |                           |
  |                                  |-- INSERT tenants -------->|
  |                                  |-- INSERT memberships      | (status=active)
  |                                  |-- assign role 'tenant_admin' to membership
  |                                  |                           |
  |                                  |-- existsByCode(workspaceCode)?->|
  |                                  |<-- false -----------------| (conflict → 409)
  |                                  |-- INSERT workspaces ------>|
  |                                  |-- INSERT workspace_memberships
  |                                  |-- assign role 'workspace_owner' to workspace_membership
  |                                  |                           |
  |                                  |-- verify tenant membership|
  |                                  |-- verify workspace membership
  |                                  |-- collect permissions      |
  |                                  |-- issue accessToken (JWT) |
  |                                  |-- issue refreshToken (JWT)|
  |                                  |-- INSERT user_sessions -->|
  |                                  |-- update lastLoginAt ----->|
  |                                  |                           |
  |<-- 201 { accessToken,            |                           |
  |          refreshToken,           |                           |
  |          userId, tenantId,       |                           |
  |          workspaceId }           |                           |
```

**DB objects created in this flow:**
1. `tenants` row
2. `memberships` row (user ↔ tenant, status=active)
3. `membership_roles` row (membership → `tenant_admin` role)
4. `workspaces` row
5. `workspace_memberships` row (membership ↔ workspace, status=active)
6. `workspace_membership_roles` row (workspace_membership → `workspace_owner` role)
7. `user_sessions` row (refresh token hash stored)

**Guards:**
- Tenant code and workspace code must be unique globally.
- Requires `tenant_admin` and `workspace_owner` system roles to be seeded in the DB (migration `004_seed_system_roles.sql`).

---

## 4. Switch Context — Get Full JWT

**Endpoint:** `POST /auth/switch-context`  
**Auth:** pre-auth token  
**Trigger:** user picks tenant + workspace after login

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- POST /auth/switch-context ---->|                           |
  |   { preAuthToken,                |                           |
  |     tenantId, workspaceId }      |                           |
  |                                  |-- verify preAuthToken     |
  |                                  |-- extract userId          |
  |                                  |                           |
  |                                  |-- findMembership          |
  |                                  |   (userId, tenantId,      |
  |                                  |    status=active) ------->|
  |                                  |<-- membership ot 401 -----|
  |                                  |                           |
  |                                  |-- findWorkspaceMembership |
  |                                  |   (membershipId,          |
  |                                  |    workspaceId,           |
  |                                  |    status=active) ------->|
  |                                  |<-- wm or 401 ------------|
  |                                  |                           |
  |                                  |-- collect permissions     |
  |                                  |   (userId, tenantId,      |
  |                                  |    workspaceId) --------->|
  |                                  |<-- [permission keys] -----|
  |                                  |                           |
  |                                  |-- build JWT claims:       |
  |                                  |   sub=userId              |
  |                                  |   tenant_id=tenantId      |
  |                                  |   workspace_id=workspaceId|
  |                                  |   permissions=[...]       |
  |                                  |   type=user               |
  |                                  |-- sign accessToken (RS256)|
  |                                  |-- issue refreshToken      |
  |                                  |-- INSERT user_sessions -->|
  |                                  |-- update lastLoginAt ----->|
  |                                  |                           |
  |<-- 200 { accessToken,            |                           |
  |          refreshToken,           |                           |
  |          userId, tenantId,       |                           |
  |          workspaceId }           |                           |
```

**List workspaces first (optional step):**
```
POST /auth/workspaces  { preAuthToken, tenantId }
→ verifies pre-auth token
→ checks active tenant membership
→ returns workspace list (active workspace_memberships for that membership)
```

---

## 5. Token Refresh

**Endpoint:** `POST /auth/refresh`  
**Auth:** public (takes refresh token in body)

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- POST /auth/refresh ----------->|                           |
  |   { refreshToken }               |                           |
  |                                  |-- verify JWT signature    |
  |                                  |-- check token_type=refresh|
  |                                  |                           |
  |                                  |-- hash refreshToken       |
  |                                  |-- findSession             |
  |                                  |   (hash, not revoked,     |
  |                                  |    not expired) --------->|
  |                                  |<-- session or 401 --------|
  |                                  |                           |
  |                                  |-- check user status=active|
  |                                  |                           |
  |                                  |-- SET session.revokedAt = NOW()  (consume old token)
  |                                  |                           |
  |                                  |-- collect permissions     |
  |                                  |-- issue new accessToken   |
  |                                  |-- issue new refreshToken  |
  |                                  |-- INSERT new user_session->|
  |                                  |-- update lastLoginAt ----->|
  |                                  |                           |
  |<-- 200 { accessToken,            |                           |
  |          refreshToken }          |                           |
```

**Key behavior:** Refresh tokens are rotated on every use. The old token is revoked immediately before the new one is issued, preventing replay.

---

## 6. Logout

### 6a. Logout All Sessions

**Endpoint:** `POST /auth/logout`  
**Auth:** Bearer access token

```
IAM Service:
  1. Extract userId from JWT (ctx.subject())
  2. UPDATE user_sessions SET revoked_at = NOW()
     WHERE user_id = userId AND revoked_at IS NULL
```

All active sessions for this user across all tenants are revoked.

### 6b. Logout Current Session Only

**Endpoint:** `POST /auth/logout/session`  
**Auth:** Bearer access token  
**Body:** `{ refreshToken }`

```
IAM Service:
  1. Hash the provided refreshToken
  2. Find session by hash where revoked_at IS NULL AND expires_at > NOW()
  3. SET session.revoked_at = NOW()
```

Only the one session matching the provided refresh token is revoked. Other devices remain logged in.

---

## 7. Change Password

**Endpoint:** `PATCH /auth/me/password`  
**Auth:** Bearer access token

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- PATCH /auth/me/password ------>|                           |
  |   { currentPassword,             |                           |
  |     newPassword }                |                           |
  |                                  |-- load user by userId     |
  |                                  |-- BCrypt verify current   |
  |                                  |   password or 401 --------|
  |                                  |                           |
  |                                  |-- hash newPassword        |
  |                                  |-- UPDATE user.passwordHash|
  |                                  |-- revokeAllSessions       |
  |                                  |   for userId ------------>|
  |                                  |                           |
  |<-- 200 OK ----------------------|
```

**Side effect:** All existing sessions are revoked after password change. The user must log in again on all devices.

---

## 8. M2M OAuth — client_credentials

**Endpoint:** `POST /oauth/token` (form-encoded)  
**Auth:** public

```
Service (e.g. Agent Orchestrator)         IAM Service                  DB
  |                                            |                         |
  |-- POST /oauth/token --------------------- >|                         |
  |   grant_type=client_credentials            |                         |
  |   client_id=<id>                           |                         |
  |   client_secret=<secret>                   |                         |
  |                                            |-- findByClientId        |
  |                                            |   where is_active=true->|
  |                                            |<-- ServiceClient or 401-|
  |                                            |                         |
  |                                            |-- BCrypt verify secret  |
  |                                            |   or 401                |
  |                                            |                         |
  |                                            |-- collect permissions   |
  |                                            |   for clientId -------->|
  |                                            |<-- [permission keys] ---|
  |                                            |                         |
  |                                            |-- build JWT claims:     |
  |                                            |   sub=clientId          |
  |                                            |   tenant_id=tenantId    |
  |                                            |   permissions=[...]     |
  |                                            |   type=service_client   |
  |                                            |-- sign accessToken      |
  |                                            |                         |
  |<-- 200 { access_token,                    |                         |
  |          token_type="Bearer",              |                         |
  |          expires_in }                      |                         |
  |                                            |                         |
  |-- API calls with Bearer token ------------>| other services          |
  |                        (verified via /.well-known/jwks.json)         |
```

**JWKS:** `GET /.well-known/jwks.json` — returns the RSA public key set. All downstream services use this to verify JWT signatures without calling IAM for each request.

---

## 9. Create Additional Tenant (Existing User)

**Endpoint:** `POST /tenants`  
**Auth:** Bearer access token (any authenticated user)

```
IAM Service:
  1. Extract userId from JWT
  2. Check tenantCode uniqueness → 409 if taken
  3. INSERT tenants (status=active)
  4. INSERT memberships (userId, tenantId, status=active)
  5. Assign role 'tenant_admin' to membership
  6. INSERT workspaces (code=workspaceCode, tenantId)
  7. INSERT workspace_memberships
  8. Assign role 'workspace_owner' to workspace_membership
  9. Return tenant DTO (does NOT issue new tokens — user switches context separately)
```

**Difference from bootstrap:** Does not issue tokens. The user must call `POST /auth/switch-context` afterward to get a JWT for the new tenant.

---

## 10. Create Workspace

**Endpoint:** `POST /tenants/{tenantId}/workspaces`  
**Auth:** Bearer access token — caller must be `tenant_admin`

```
IAM Service:
  1. requireActiveMembership(userId, tenantId)  → 403 if not a member
  2. requireTenantAdmin(userId, tenantId)        → 403 if not tenant_admin
  3. Check workspaceCode uniqueness within tenantId → 409 if taken
  4. INSERT workspaces (tenantId, code, name, description, status=active, createdByUserId)
  5. INSERT workspace_memberships (creator ↔ workspace, status=active)
  6. Assign role 'workspace_owner' to workspace_membership
  7. Return workspace DTO
```

---

## 11. Invite User to Tenant

**Endpoint:** `POST /tenants/{tenantId}/members`  
**Auth:** Bearer access token — caller must be `tenant_admin`  
**Body:** `{ email, roleKey }`

```
IAM Service:
  1. requireTenantAdmin(inviterId, tenantId)
  2. Find target user by email → 404 if not found (must sign up first)
  3. Check target not already an active member → 409 if duplicate
  4. Validate roleKey:
     - Load role by key from roles visible to tenant
     - Reject if scope_type = 'platform' → 403
     - Reject if scope_type ≠ 'tenant'   → 400
  5. INSERT memberships (targetUserId, tenantId, status=active)
  6. INSERT membership_roles (membershipId, roleId)
  7. Return TenantMemberDto { membershipId, userId, email, name, joinedAt, roles }
```

**Guard on role scope:** Platform roles (`platform_admin`) can never be assigned through the member invite flow.

---

## 12. Remove Member from Tenant

**Endpoint:** `DELETE /tenants/{tenantId}/members/{userId}`  
**Auth:** Bearer access token — caller must be `tenant_admin`

```
IAM Service:
  1. requireTenantAdmin(removerId, tenantId)
  2. Find target membership (userId, tenantId, status=active) → 404 if not found
  3. For each workspace_membership of this membership:
     a. DELETE workspace_membership_roles (all role assignments in that workspace)
     b. SET workspace_membership.status = 'inactive'
  4. DELETE membership_roles for this membership
  5. SET membership.status = 'inactive'
  6. Revoke all user_sessions WHERE userId = targetUserId AND tenantId = tenantId
     (other-tenant sessions are preserved)
```

---

## 13. Invite User to Workspace

**Endpoint:** `POST /tenants/{tenantId}/workspaces/{workspaceId}/members`  
**Auth:** Bearer access token — caller must be `tenant_admin`  
**Body:** `{ email, roleKey }`

```
IAM Service:
  1. requireTenantAdmin(inviterId, tenantId)
  2. Verify workspaceId belongs to tenantId → 404 if not
  3. Find target user by email → 404 if not found
  4. Find target's active tenant membership → 404 if not a tenant member
     (prerequisite: invite to tenant first)
  5. Check target not already an active workspace member → 409
  6. Validate roleKey:
     - Load role by key from roles visible to tenant
     - Reject if scope_type = 'platform' → 403
     - Reject if scope_type ≠ 'workspace' → 400
  7. INSERT workspace_memberships (idempotent — skips if already exists)
  8. INSERT workspace_membership_roles (workspaceMembershipId, roleId)
  9. Return WorkspaceMemberDto { workspaceMembershipId, userId, email, name, joinedAt, roles }
```

---

## 14. Remove Member from Workspace

**Endpoint:** `DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{userId}`  
**Auth:** Bearer access token — caller must be `tenant_admin`

```
IAM Service:
  1. requireTenantAdmin(removerId, tenantId)
  2. Verify workspaceId belongs to tenantId
  3. Find target tenant membership → 404
  4. Find target workspace_membership (membershipId, workspaceId, status=active) → 404
  5. DELETE workspace_membership_roles for this workspace_membership
  6. SET workspace_membership.status = 'inactive'
  (tenant membership and other workspace memberships are NOT affected)
```

---

## 15. Tenant Role Management

### Assign Tenant Role

**Endpoint:** `POST /tenants/{tenantId}/members/{targetUserId}/roles`  
**Body:** `{ roleKey }`

```
IAM Service:
  1. requireTenantAdmin(assignerId, tenantId)
  2. Find target membership → 404
  3. Validate roleKey (scope must be 'tenant', not 'platform')
  4. Check not already assigned → 409
  5. INSERT membership_roles (membershipId, roleId)
```

### Revoke Tenant Role

**Endpoint:** `DELETE /tenants/{tenantId}/members/{targetUserId}/roles/{roleKey}`

```
IAM Service:
  1. requireTenantAdmin(revokerId, tenantId)
  2. Find target membership → 404
  3. Validate roleKey (must be tenant-scoped)
  4. Check is assigned → 404 if not
  5. DELETE membership_roles (membershipId, roleId)
```

---

## 16. Workspace Role Management

### Assign Workspace Role

**Endpoint:** `POST /tenants/{tenantId}/workspaces/{workspaceId}/members/{targetUserId}/roles`  
**Body:** `{ roleKey }`

```
IAM Service:
  1. requireTenantAdmin(assignerId, tenantId)
  2. Verify workspace belongs to tenant
  3. Find target tenant membership → 404
  4. Find target workspace_membership → 404
  5. Validate roleKey (scope must be 'workspace', not 'platform' or 'tenant')
  6. Check not already assigned → 409
  7. INSERT workspace_membership_roles
```

### Revoke Workspace Role

**Endpoint:** `DELETE /tenants/{tenantId}/workspaces/{workspaceId}/members/{targetUserId}/roles/{roleKey}`

```
Same guards as assign (`tenant_admin`, workspace belongs to tenant, target membership exists, target workspace membership exists, workspace-scoped role), then:
  DELETE workspace_membership_roles (workspaceMembershipId, roleId)
```

---

## 17. Custom Role CRUD

**Requires:** `tenant_admin` role  
**System roles** (`is_system = true`) are immutable — they cannot be updated or deleted.

### Create Custom Role

**Endpoint:** `POST /roles`  
**Body:** `{ key, name, scopeType, description }`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. Check key uniqueness against platform-visible and tenant-owned roles → 409 if taken
  3. Clamp scopeType: only 'tenant' or 'workspace' allowed
     (any other value → defaults to 'workspace')
  4. INSERT roles (tenantId, key, name, scopeType, description, is_system=false)
  5. Return RoleDto
```

### Update Custom Role

**Endpoint:** `PATCH /roles/{roleId}`  
**Body:** `{ name, description }`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. Load role → 404 if not found
  3. Check tenantId matches role.tenantId → 403 if platform-level
  4. Check is_system = false → 403 if system role
  5. UPDATE roles (name, description, updatedAt)
```

### Delete Custom Role

**Endpoint:** `DELETE /roles/{roleId}`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. Load and verify (same guards as update)
  3. DELETE role_permissions for this role
  4. DELETE roles row
```

---

## 18. Assign / Revoke Permission on Role

**Requires:** `tenant_admin` role  
**Constraint:** Permission must be visible to the tenant (platform-level OR tenant's own).

### Assign Permission

**Endpoint:** `POST /roles/{roleId}/permissions`  
**Body:** `{ permissionId }`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. Load role, verify it is visible and mutable (not system, belongs to tenant)
  3. Call permissionService.getPermission(permissionId, tenantId):
     - Loads permission → 404 if not found
     - If permission.tenantId ≠ NULL AND ≠ caller's tenantId → 404
       (prevents cross-tenant permission assignment)
  4. Check not already assigned → 409
  5. INSERT role_permissions (roleId, permissionId)
```

### Revoke Permission

**Endpoint:** `DELETE /roles/{roleId}/permissions/{permissionId}`

```
IAM Service:
  1-2. Same guards as assign
  3. Check assigned → 404 if not
  4. DELETE role_permissions (roleId, permissionId)
```

---

## 19. Custom Permission CRUD

**Visibility rules:**
- `tenant_id IS NULL` → platform permission, visible to all tenants (managed by platform admin)
- `tenant_id = UUID` → tenant permission, visible only to that tenant

### Create Custom Permission

**Endpoint:** `POST /permissions`  
**Auth:** `tenant_admin`  
**Body:** `{ key, resource, action, description }`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. Uniqueness checks (across platform AND tenant namespace):
     - existsByKey where tenant_id IS NULL → 409 if key shadows a platform key
     - existsByKey where tenant_id = tenantId → 409 if duplicate
     - existsByResource+action where tenant_id IS NULL → 409
     - existsByResource+action where tenant_id = tenantId → 409
  3. INSERT permissions (tenantId, key, resource, action, description, is_system=false)
  4. Return PermissionDto { id, tenantId, key, resource, action, description, isSystem }
```

### Update Permission

**Endpoint:** `PATCH /permissions/{id}`  
**Body:** `{ description }`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. getPermission(id, tenantId) — verifies visibility
  3. Check is_system = false → 403
  4. Check permission.tenantId = caller's tenantId → 403 if platform permission
  5. UPDATE permissions (description)
```

### Delete Permission

**Endpoint:** `DELETE /permissions/{id}`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. getPermission(id, tenantId) — verifies visibility
  3. Check is_system = false → 403
  4. Check permission.tenantId = caller's tenantId → 403 if platform permission
  5. Check not in use:
     - existsByPermissionId in role_permissions → 409
     - existsByPermissionId in service_client_permissions → 409
  6. DELETE permissions row
```

### Read Permissions

```
GET /permissions       → platform permissions (tenant_id IS NULL) + caller's tenant's own permissions
GET /permissions/{id}  → same visibility filter applied per-record
GET /permissions/me    → reads permissions[] directly from the JWT claim (no DB query)
```

---

## 20. Service Client Lifecycle

### Create Service Client

**Endpoint:** `POST /service-clients`  
**Requires:** `tenant_admin`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. Check clientId global uniqueness → 409 if taken
  3. Generate plainSecret = UUID + UUID (64 hex chars, no dashes)
  4. secretHash = BCrypt(plainSecret)
  5. INSERT service_clients:
     { tenantId, clientId, serviceName, secretHash, secretAlgorithm='bcrypt',
       description, allowedAudiences, accessTokenTtlSeconds, is_active=true }
  6. Return { client: ServiceClientDto, clientSecret: plainSecret }
     ← plain secret is returned ONLY here, never again
```

### Rotate Secret

**Endpoint:** `POST /service-clients/{id}/rotate-secret`  
**Requires:** `tenant_admin`

```
IAM Service:
  1. requireTenantAdmin + verify client belongs to tenant
  2. Generate new plainSecret
  3. UPDATE service_clients SET secretHash = BCrypt(plainSecret)
  4. Return { client, clientSecret: newPlainSecret }
```

**Existing tokens** (already issued) remain valid until they expire — rotation does not invalidate them immediately.

### Activate / Deactivate

```
PATCH /service-clients/{id}/activate    → SET is_active = true
PATCH /service-clients/{id}/deactivate  → SET is_active = false
```

Deactivated clients cannot obtain new tokens (`findByClientIdAndIsActiveTrue` fails → 401).

### Delete Service Client

```
IAM Service:
  1. requireTenantAdmin + verify ownership
  2. DELETE service_client_permissions for this client
  3. DELETE service_clients row
```

---

## 21. Assign / Revoke Permission on Service Client

**Requires:** `tenant_admin`  
**Same visibility constraint as roles** — only platform-level or tenant's own permissions can be assigned.

### Assign

**Endpoint:** `POST /service-clients/{id}/permissions`  
**Body:** `{ permissionId }`

```
IAM Service:
  1. requireTenantAdmin(userId, tenantId)
  2. Load client, verify tenantId matches → 403
  3. permissionService.getPermission(permissionId, tenantId)
     (visibility check — cross-tenant assignment is rejected)
  4. Check not already assigned → 409
  5. INSERT service_client_permissions (serviceClientId, permissionId)
```

### Revoke

**Endpoint:** `DELETE /service-clients/{id}/permissions/{permissionId}`

```
IAM Service:
  1-2. Same guards
  3. Check assigned → 404 if not
  4. DELETE service_client_permissions row
```

---

## 22. Feature Management (Platform Admin)

**Platform admin** = any user whose active membership includes a role with `scope_type = 'platform'`.  
Read endpoints are open to all authenticated users.

### Create Feature

**Endpoint:** `POST /features`

```
IAM Service:
  1. requirePlatformAdmin(userId):
     a. Load all active memberships for userId
     b. Load all membership_roles for those memberships
     c. Load roles by those IDs
     d. Any role with scope_type = 'platform' → pass; else 403
  2. INSERT features (key, name, description, is_system=false)
  3. Return FeatureDto
```

### Update Feature

**Endpoint:** `PATCH /features/{id}`

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. Load feature → 404
  3. UPDATE features (name, description)
```

### Delete Feature

**Endpoint:** `DELETE /features/{id}`

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. Load feature → 404
  3. DELETE features row
  (if feature has active entitlements, downstream queries may return empty — no explicit guard currently)
```

### Read Features

```
GET /features       → list all (authenticated, no admin check)
GET /features/{id}  → get one (authenticated, no admin check)
```

---

## 23. Entitlement Management (Platform Admin)

Entitlements link a **feature or model** to a **tenant**, controlling what that tenant can use.

### Feature Entitlement — Grant

**Endpoint:** `POST /entitlements/features`  
**Requires:** platform admin  
**Body:** `{ featureKey, enabled, config }`

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. Look up feature by featureKey → 404 if not found
  3. Check not already granted to this tenant → 409
  4. INSERT feature_entitlements (tenantId, featureId, enabled, config)
  5. Return FeatureEntitlement
```

### Feature Entitlement — Update

**Endpoint:** `PATCH /entitlements/features/{featureId}`  
**Body:** `{ enabled, config }`

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. Load entitlement for (tenantId, featureId) → 404
  3. UPDATE (enabled, config)
```

### Feature Entitlement — Revoke

**Endpoint:** `DELETE /entitlements/features/{featureId}`

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. Load entitlement → 404
  3. DELETE feature_entitlements row
```

### Model Entitlement — Grant

**Endpoint:** `POST /entitlements/models`  
**Requires:** platform admin  
**Body:** `{ modelKey, operationType, allowed, rpmLimit, tpmLimit, dailyTokenLimit, monthlyTokenLimit, config }`

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. Check not already granted for (tenantId, modelKey, operationType) → 409
  3. INSERT model_entitlements with all rate limit fields
  4. Return ModelEntitlement
```

### Model Entitlement — Update

**Endpoint:** `PATCH /entitlements/models/{id}`  
**Body:** `{ allowed, rpmLimit, tpmLimit, dailyTokenLimit, monthlyTokenLimit, config }`

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. Load entitlement → 404, verify it belongs to caller's tenant context
  3. Update non-null fields only
```

### Read Entitlements

```
GET /entitlements/features       → enriched summary (feature name + enabled flag) for caller's tenant
GET /entitlements/features/all   → raw entitlement rows for caller's tenant
GET /entitlements/models         → enriched summary (model name + limits) for caller's tenant
GET /entitlements/models/all     → raw rows
```

These are readable by anyone with an active JWT — tenant context comes from `ctx.tenantId()`.

---

## 24. How Effective Permissions Are Computed

Permissions are embedded in the JWT at token issuance time. There is **no runtime permission check** via DB on each API request — the JWT is verified by signature, and the `permissions` claim is read directly.

### For User Tokens (issued at switch-context or refresh)

```sql
-- Workspace-scoped query (workspaceId is provided)
SELECT DISTINCT p.key
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
JOIN roles r ON r.id = rp.role_id
JOIN membership_roles mr ON mr.role_id = r.id
JOIN memberships m ON m.id = mr.membership_id
WHERE m.user_id = :userId
  AND m.tenant_id = :tenantId
  AND m.status = 'active'

UNION

SELECT DISTINCT p.key
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
JOIN workspace_membership_roles wmr ON wmr.role_id = rp.role_id
JOIN workspace_memberships wm ON wm.id = wmr.workspace_membership_id
JOIN memberships m ON m.id = wm.membership_id
WHERE m.user_id = :userId
  AND wm.workspace_id = :workspaceId
  AND wm.status = 'active'
```

Result: union of all permissions from all tenant-level roles + all workspace-level roles the user holds in that context.

### For Service Client Tokens (issued at /oauth/token)

```sql
SELECT DISTINCT p.key
FROM permissions p
JOIN service_client_permissions scp ON scp.permission_id = p.id
JOIN service_clients sc ON sc.id = scp.service_client_id
WHERE sc.client_id = :clientId
```

Result: all permissions explicitly assigned to the service client.

### Permission Claims in the JWT

```json
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "workspace_id": "workspace-uuid",
  "type": "user",
  "permissions": ["agent:read", "agent:write", "tool:read"],
  "exp": 1234567890
}
```

Downstream services verify the JWT signature using `GET /.well-known/jwks.json` and read `permissions` directly — no IAM roundtrip needed per request.

### Checking Permissions from JWT (no DB)

```
GET /permissions/me
→ reads ctx.permissions() from the already-verified JWT
→ returns { permissions: ["agent:read", ...] }
→ 0 DB queries
```

---

## 25. Platform Admin — Cross-Tenant Roles & Permissions

**Endpoints:**
- `GET /platform/tenants/{tenantId}/roles`
- `GET /platform/tenants/{tenantId}/permissions`

**Auth:** Bearer access token — caller must have a role with `scope_type = 'platform'` (i.e. `platform_admin`).  
**Purpose:** Read-only inspection of any tenant's role and permission configuration without being a member of that tenant.

### GET /platform/tenants/{tenantId}/roles

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- GET /platform/tenants/         |                           |
  |       {tenantId}/roles --------->|                           |
  |                                  |-- requirePlatformAdmin:   |
  |                                  |   load all memberships    |
  |                                  |   for userId ------------>|
  |                                  |<-- memberships -----------|
  |                                  |   load membership_roles ->|
  |                                  |<-- role IDs --------------|
  |                                  |   load roles by IDs ------>|
  |                                  |<-- roles -----------------|
  |                                  |   any with scope_type     |
  |                                  |   = 'platform'? or 403    |
  |                                  |                           |
  |                                  |-- roleRepo.               |
  |                                  |   findVisibleToTenant     |
  |                                  |   (tenantId) ------------>|
  |                                  |<-- [platform roles        |
  |                                  |    + tenant custom roles]-|
  |                                  |                           |
  |<-- 200 [RoleDto, ...] -----------|
```

Returns: system roles (`tenant_id IS NULL`) + any custom roles the tenant has created.

### GET /platform/tenants/{tenantId}/permissions

```
Client                          IAM Service                     DB
  |                                  |                           |
  |-- GET /platform/tenants/         |                           |
  |       {tenantId}/permissions --->|                           |
  |                                  |-- requirePlatformAdmin    |
  |                                  |   (same check as above)   |
  |                                  |                           |
  |                                  |-- permissionRepo.         |
  |                                  |   findVisibleToTenant     |
  |                                  |   (tenantId) ------------>|
  |                                  |<-- [platform permissions  |
  |                                  |    + tenant custom ones]--|
  |                                  |                           |
  |<-- 200 [PermissionDto, ...] -----|
```

Returns: system permissions (`tenant_id IS NULL`) + any custom permissions the tenant has created.

### Tenant Listing — Platform Anchor Excluded

`GET /platform/tenants` also runs a post-query filter:

```
IAM Service:
  1. requirePlatformAdmin(userId)
  2. tenantRepo.findByStatus('active')         — finds all active tenants including the internal anchor
  3. filter out plan_key = 'platform'          — removes the platform tenant itself
  4. Return list of real customer tenants
```

This prevents the internal `platform` anchor tenant (seeded by migration V7, housing the admin account)
from appearing in admin UIs. Customer-created tenants always have `plan_key = 'basic'` or another
custom key, never `'platform'`.
