// Spring Data Page wrapper (raw — no ApiResponse envelope)
export interface SpringPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number // 0-based
  size: number
}

// ---- Permission ----
export interface PermissionResponse {
  id: string
  resource: string
  action: string
  description: string | null
  createdAt: string
}

export interface CreatePermissionRequest {
  resource: string
  action: string
  description?: string
}

// ---- Role ----
export interface RoleResponse {
  id: string
  scopeType: string // 'platform' | 'tenant'
  name: string
  description: string | null
  isSystem: boolean
  permissions: PermissionResponse[]
  createdAt: string
  updatedAt: string
}

export interface CreateRoleRequest {
  name: string
  scopeType?: string
  description?: string
  isSystem?: boolean
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
}

export interface AssignPermissionsRequest {
  permissionIds: string[]
}

// ---- Tenant ----
export interface TenantResponse {
  id: string
  code: string
  name: string
  status: string // 'active' | 'disabled'
  planKey: string
  settings: string | null // JSON string
  createdAt: string
  updatedAt: string
}

// ---- Feature Entitlement ----
export interface FeatureEntitlementResponse {
  id: string
  tenantId: string
  featureKey: string
  enabled: boolean
  config: string | null // JSON string
  createdAt: string
  updatedAt: string
}

export interface CreateFeatureEntitlementRequest {
  featureKey: string
  enabled?: boolean
  config?: string // JSON string
}

export interface UpdateFeatureEntitlementRequest {
  enabled?: boolean
  config?: string // JSON string
}

// ---- Model Entitlement ----
export interface ModelEntitlementResponse {
  id: string
  tenantId: string
  modelKey: string
  operationType: string // 'chat' | 'embedding' | 'rerank'
  allowed: boolean
  rpmLimit: number | null
  tpmLimit: number | null
  dailyTokenLimit: number | null
  monthlyTokenLimit: number | null
  config: string | null // JSON string
  createdAt: string
  updatedAt: string
}

export interface CreateModelEntitlementRequest {
  modelKey: string
  operationType: string
  allowed?: boolean
  rpmLimit?: number | null
  tpmLimit?: number | null
  dailyTokenLimit?: number | null
  monthlyTokenLimit?: number | null
  config?: string // JSON string
}

export interface UpdateModelEntitlementRequest {
  allowed?: boolean
  rpmLimit?: number | null
  tpmLimit?: number | null
  dailyTokenLimit?: number | null
  monthlyTokenLimit?: number | null
  config?: string // JSON string
}

// ---- User ----
export interface UserResponse {
  id: string
  email: string
  name: string | null
  status: string // 'active' | 'disabled'
  emailVerified: boolean | null
  avatarUrl: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateUserRequest {
  name?: string
  status?: string // 'active' | 'disabled'
  avatarUrl?: string
}

// ---- Membership ----
export interface MembershipResponse {
  id: string
  userId: string
  userEmail: string
  userName: string | null
  tenantId: string
  tenantName: string
  status: string // 'active' | 'invited'
  joinedAt: string | null
  createdAt: string
}

export interface AddMemberRequest {
  userId: string
  status?: string // 'active' | 'invited'
}

// ---- Tenant (full CRUD types) ----
export interface CreateTenantRequest {
  name: string
  code?: string
  planKey?: string // 'basic' | 'pro' | 'enterprise'
}

export interface UpdateTenantRequest {
  name?: string
  status?: string // 'active' | 'disabled'
  planKey?: string // 'basic' | 'pro' | 'enterprise'
  settings?: string // JSON string
}

// ---- API Key ----
export interface ApiKeyResponse {
  id: string
  tenantId: string
  createdByUserId: string
  name: string
  keyPrefix: string | null
  scopes: string | null // JSON array string e.g. '["agent:run"]'
  status: string // 'active' | 'revoked'
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  rawKey?: string // only present immediately after creation
}

export interface CreateApiKeyRequest {
  name: string
  scopes?: string // JSON array string
  expiresAt?: string | null
}

export interface UpdateApiKeyRequest {
  name?: string
  scopes?: string // JSON array string
  expiresAt?: string | null
}

// ---- Audit Log ----
export interface AuditLogResponse {
  id: string
  actorType: string | null // 'user' | 'api_key' | 'system'
  actorId: string | null
  tenantId: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  decision: string | null // 'allow' | 'deny'
  reason: string | null
  metadata: string | null // JSON string
  createdAt: string
}

// ---- Auth ----
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
