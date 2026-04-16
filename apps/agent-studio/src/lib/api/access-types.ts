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
