# IAM Service — Sequence Diagrams

## 1. New User — Sign Up + Bootstrap (full first-login flow)

The path for a brand-new user who has no tenant yet.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant IAM as IAM Service
    participant DB as PostgreSQL

    Note over C,DB: ── Step 1: Create account ──
    C->>IAM: POST /auth/signup {name, email, password}
    IAM->>DB: SELECT exists WHERE email = ?
    DB-->>IAM: false
    IAM->>IAM: BCrypt hash password
    IAM->>DB: INSERT users {id, email, name, password_hash, status=active}
    DB-->>IAM: userId
    IAM-->>C: 201 {userId, email, name}

    Note over C,DB: ── Step 2: Login → pre-auth token ──
    C->>IAM: POST /auth/login {email, password}
    IAM->>DB: SELECT user WHERE email = ?
    DB-->>IAM: user row
    IAM->>IAM: BCrypt verify password
    IAM->>DB: SELECT memberships WHERE user_id = ? AND status = active
    DB-->>IAM: [] (empty — new user)
    IAM->>IAM: issue preAuthToken (RS256, token_type=pre_auth, TTL=5min)
    IAM-->>C: 200 {preAuthToken, requireTenantCreation=true}

    Note over C,DB: ── Step 3: Bootstrap first tenant + workspace ──
    C->>IAM: POST /tenants/bootstrap {preAuthToken, tenantCode, tenantName, workspaceCode, workspaceName}
    IAM->>IAM: verify preAuthToken (token_type must be pre_auth)
    IAM->>IAM: extract userId from sub claim
    IAM->>DB: SELECT exists WHERE tenants.code = tenantCode
    DB-->>IAM: false
    IAM->>DB: INSERT tenants {id, code, name, status=active}
    IAM->>DB: INSERT memberships {id, tenant_id, user_id, status=active}
    IAM->>DB: SELECT roles WHERE key = 'tenant_admin'
    DB-->>IAM: role row (seeded by V4 migration)
    IAM->>DB: INSERT membership_roles {membership_id, role_id}
    IAM->>DB: INSERT workspaces {id, tenant_id, code, name, created_by_user_id}
    IAM->>DB: INSERT workspace_memberships {id, workspace_id, membership_id}
    IAM->>DB: SELECT roles WHERE key = 'workspace_owner'
    DB-->>IAM: role row
    IAM->>DB: INSERT workspace_membership_roles {workspace_membership_id, role_id}

    IAM->>DB: SELECT permissions via membership+workspace roles (UNION query)
    DB-->>IAM: [permission keys]
    IAM->>IAM: build JWT claims {sub, tenant_id, workspace_id, type=user, permissions}
    IAM->>IAM: sign accessToken (RS256, TTL=1h)
    IAM->>IAM: sign refreshToken (RS256, TTL=7d)
    IAM->>DB: INSERT user_sessions {user_id, tenant_id, workspace_id, session_token_hash, expires_at}
    IAM->>DB: UPDATE users SET last_login_at = NOW()
    IAM-->>C: 201 {accessToken, refreshToken, userId, tenantId, workspaceId}
```

---

## 2. Returning User — Login + Context Selection

The path for a user who already has one or more tenants.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant IAM as IAM Service
    participant DB as PostgreSQL

    Note over C,DB: ── Step 1: Login → pre-auth token ──
    C->>IAM: POST /auth/login {email, password}
    IAM->>DB: SELECT user WHERE email = ?
    DB-->>IAM: user row
    IAM->>IAM: BCrypt verify password
    IAM->>DB: SELECT memberships WHERE user_id = ? AND status = active
    DB-->>IAM: [membership rows with tenantId]

    alt exactly one membership
        IAM->>IAM: issue preAuthToken
        IAM-->>C: 200 {preAuthToken, requireTenantSelection=false, singleTenantId=UUID}
    else multiple memberships
        IAM->>IAM: issue preAuthToken
        IAM-->>C: 200 {preAuthToken, requireTenantSelection=true, tenants=[...]}
    end

    Note over C,DB: ── Step 2: List workspaces for chosen tenant ──
    C->>IAM: POST /auth/workspaces {preAuthToken, tenantId}
    IAM->>IAM: verify preAuthToken
    IAM->>DB: SELECT membership WHERE user_id = ? AND tenant_id = ? AND status = active
    DB-->>IAM: membership row
    IAM->>DB: SELECT workspace_memberships WHERE membership_id = ? AND status = active
    DB-->>IAM: [workspace rows]
    IAM-->>C: 200 {workspaces: [{id, code, name}]}

    Note over C,DB: ── Step 3: Switch context → full JWT ──
    C->>IAM: POST /auth/switch-context {preAuthToken, tenantId, workspaceId}
    IAM->>IAM: verify preAuthToken
    IAM->>IAM: extract userId
    IAM->>DB: SELECT membership WHERE user_id=? AND tenant_id=? AND status=active
    DB-->>IAM: membership or 401
    IAM->>DB: SELECT workspace_membership WHERE membership_id=? AND workspace_id=? AND status=active
    DB-->>IAM: wm or 401
    IAM->>DB: SELECT permissions via UNION query (tenant roles + workspace roles)
    DB-->>IAM: [permission keys]
    IAM->>IAM: build JWT claims {sub=userId, tenant_id, workspace_id, type=user, permissions, iss=iam-service, aud=[studio,datahub,aihub]}
    IAM->>IAM: sign accessToken (RS256, TTL=1h)
    IAM->>IAM: sign refreshToken (RS256, TTL=7d)
    IAM->>DB: INSERT user_sessions {session_token_hash=SHA-256(refreshToken), expires_at}
    IAM->>DB: UPDATE users SET last_login_at = NOW()
    IAM-->>C: 200 {accessToken, refreshToken, userId, tenantId, workspaceId}
```

---

## 3. Token Refresh (with rotation)

Every refresh call rotates the refresh token. Old token is revoked before the new one is issued.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant IAM as IAM Service
    participant DB as PostgreSQL

    C->>IAM: POST /auth/refresh {refreshToken}
    IAM->>IAM: verify JWT signature (RS256)
    IAM->>IAM: check token_type == "refresh" → else 401
    IAM->>IAM: hash = SHA-256(refreshToken)
    IAM->>DB: SELECT session WHERE session_token_hash = hash AND revoked_at IS NULL AND expires_at > NOW()
    DB-->>IAM: session row (userId, tenantId, workspaceId) or 401

    IAM->>DB: SELECT user WHERE id = session.userId AND status = active
    DB-->>IAM: user row or 401

    IAM->>DB: UPDATE user_sessions SET revoked_at = NOW() WHERE id = session.id
    Note over IAM,DB: Old token is consumed — replay is now impossible

    IAM->>DB: SELECT permissions via UNION query (re-evaluates current roles)
    DB-->>IAM: [permission keys]
    IAM->>IAM: build new JWT claims {sub, tenant_id, workspace_id, type=user, permissions}
    IAM->>IAM: sign new accessToken (RS256, TTL=1h)
    IAM->>IAM: sign new refreshToken (RS256, TTL=7d)
    IAM->>DB: INSERT user_sessions {new session_token_hash, expires_at}
    IAM->>DB: UPDATE users SET last_login_at = NOW()
    IAM-->>C: 200 {accessToken, refreshToken}
```

---

## 4. M2M — Service Client client_credentials

Used by services like DataWorker and Agent Orchestrator to obtain a Bearer token for calling other services.

```mermaid
sequenceDiagram
    autonumber
    participant SVC as Service<br/>(e.g. DataWorker)
    participant IAM as IAM Service
    participant DB as PostgreSQL
    participant DS as Downstream Service<br/>(e.g. AIHub)

    Note over SVC,IAM: ── Obtain M2M access token ──
    SVC->>IAM: POST /oauth/token (form-encoded)<br/>grant_type=client_credentials<br/>client_id=data-worker-client<br/>client_secret=<secret>

    IAM->>DB: SELECT service_client WHERE client_id = ? AND is_active = true
    DB-->>IAM: client row or 401

    IAM->>IAM: BCrypt verify secret → 401 if mismatch

    IAM->>DB: SELECT permissions WHERE service_client_id = client.id
    DB-->>IAM: [permission keys]

    IAM->>IAM: build JWT claims:<br/>{sub=clientId, client_id, tenant_id (if set),<br/>type=service_client, permissions,<br/>iss=iam-service, aud=client.allowedAudiences}
    IAM->>IAM: sign accessToken (RS256, TTL=client.accessTokenTtlSeconds)
    IAM-->>SVC: 200 {access_token, token_type=Bearer, expires_in}

    Note over SVC,DS: ── Use token to call downstream service ──
    SVC->>DS: POST /v1/... Authorization: Bearer <access_token>
    DS->>DS: verify JWT via cached JWKS public key
    DS->>DS: check iss = "iam-service"
    DS->>DS: check aud contains "aihub"
    DS->>DS: check token_type = "access"
    DS->>DS: check exp not expired
    DS->>DS: read caller_type = "service_client" from type claim
    DS-->>SVC: response
```

---

## 5. Downstream JWT Verification (no IAM roundtrip)

How DataHub, AIHub, and other downstream services verify tokens locally using the cached JWKS public key. IAM is only called once per key rotation event, not on every request.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant SVC as Downstream Service<br/>(DataHub / AIHub)
    participant JWKS as JWKS Cache<br/>(in-memory)
    participant IAM as IAM Service<br/>/.well-known/jwks.json

    Note over SVC,IAM: ── Service startup ──
    SVC->>IAM: GET /.well-known/jwks.json
    IAM-->>SVC: {keys: [{kid, kty, alg, n, e}]}
    SVC->>JWKS: store kid → RSAPublicKey map

    Note over C,JWKS: ── Every authenticated request ──
    C->>SVC: Authorization: Bearer <jwt>
    SVC->>SVC: decode JWT header → extract kid
    SVC->>JWKS: lookup RSAPublicKey by kid

    alt kid is known (cache hit)
        JWKS-->>SVC: RSAPublicKey
    else kid is unknown (key rotation just happened)
        SVC->>IAM: GET /.well-known/jwks.json
        IAM-->>SVC: updated key set with new kid
        SVC->>JWKS: refresh cache
        JWKS-->>SVC: RSAPublicKey (or 401 if still unknown)
    end

    SVC->>SVC: verify RS256 signature using RSAPublicKey
    SVC->>SVC: validate claims:
    Note over SVC: token_type == "access"
    Note over SVC: exp > now()
    Note over SVC: iss == "iam-service"
    Note over SVC: aud contains expected audience (e.g. "datahub")

    alt valid
        SVC->>SVC: extract tenant_id, workspace_id, sub, type, permissions
        SVC-->>C: process request
    else invalid
        SVC-->>C: 401 Unauthorized
    end
```

---

## 6. Permission Collection at Token Issuance

How IAM computes the `permissions` claim embedded in every access token. There is **no per-request DB call** on downstream services — permissions are computed once here.

```mermaid
sequenceDiagram
    autonumber
    participant IAM as IAM Service
    participant DB as PostgreSQL

    Note over IAM,DB: ── User token (called during switch-context or refresh) ──
    IAM->>DB: UNION query for userId + tenantId + workspaceId

    DB->>DB: Part 1 — tenant-level permissions:<br/>permissions → role_permissions → roles<br/>→ membership_roles → memberships<br/>WHERE memberships.user_id = userId<br/>AND memberships.tenant_id = tenantId<br/>AND memberships.status = active

    DB->>DB: Part 2 — workspace-level permissions:<br/>permissions → role_permissions<br/>→ workspace_membership_roles<br/>→ workspace_memberships → memberships<br/>WHERE memberships.user_id = userId<br/>AND workspace_memberships.workspace_id = workspaceId<br/>AND workspace_memberships.status = active

    DB-->>IAM: DISTINCT permission keys (union of both parts)

    Note over IAM,DB: ── Service client token (called during /oauth/token) ──
    IAM->>DB: SELECT DISTINCT p.key<br/>FROM permissions p<br/>JOIN service_client_permissions scp ON scp.permission_id = p.id<br/>WHERE scp.service_client_id = client.id
    DB-->>IAM: [permission keys]

    Note over IAM: Both results are embedded in JWT as permissions: [...]
    Note over IAM: Downstream services read this array directly — 0 DB queries per request
```

---

## 7. Logout — Single Session vs All Sessions

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant IAM as IAM Service
    participant DB as PostgreSQL

    alt POST /auth/logout — revoke ALL sessions
        C->>IAM: POST /auth/logout<br/>Authorization: Bearer <accessToken>
        IAM->>IAM: extract userId from JWT sub claim
        IAM->>DB: UPDATE user_sessions SET revoked_at = NOW()<br/>WHERE user_id = userId AND revoked_at IS NULL
        DB-->>IAM: N rows updated
        IAM-->>C: 200 OK
        Note over C: All devices logged out — including other tenants
    else POST /auth/logout/session — revoke ONE session
        C->>IAM: POST /auth/logout/session {refreshToken}<br/>Authorization: Bearer <accessToken>
        IAM->>IAM: hash = SHA-256(refreshToken)
        IAM->>DB: SELECT session WHERE hash = ? AND revoked_at IS NULL AND expires_at > NOW()
        DB-->>IAM: session row or 404
        IAM->>DB: UPDATE user_sessions SET revoked_at = NOW() WHERE id = session.id
        IAM-->>C: 200 OK
        Note over C: Only the session matching this refresh token is revoked
    end
```

---

## 8. Signing Key Rotation

How IAM rotates the RSA key pair used to sign JWTs without invalidating in-flight tokens.

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Platform Admin
    participant IAM as IAM Service
    participant DB as PostgreSQL
    participant DS as Downstream Services

    Note over Admin,DB: ── Generate and activate a new key pair ──
    Admin->>IAM: POST /admin/signing-keys/rotate (platform admin only)
    IAM->>IAM: generate new RSAKeyPair (2048+ bit)
    IAM->>IAM: encrypt privateKey with KMS/Vault
    IAM->>DB: INSERT oauth_signing_keys {kid=new-kid, public_jwk, encrypted_private_jwk, status=active}
    Note over DB: Partial unique index enforces only one active key
    IAM->>DB: UPDATE oauth_signing_keys SET status = retired WHERE status = active AND id != newId
    IAM-->>Admin: 200 {newKeyId}

    Note over DS,DB: ── Downstream services transparently pick up new key ──
    DS->>IAM: GET /.well-known/jwks.json
    IAM->>DB: SELECT public_jwk WHERE status IN (active, retired)
    DB-->>IAM: [new public_jwk, old public_jwk]
    IAM-->>DS: {keys: [newKey, oldKey]}
    Note over DS: Both keys cached — tokens signed by old key still verify until they expire
```
