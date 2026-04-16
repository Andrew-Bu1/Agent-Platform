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
