import { get, fetchWithAuth } from './client'
import { tokenStorage } from './tokenStorage'
import type {
  AssignPermissionsRequest,
  CreateFeatureEntitlementRequest,
  CreateModelEntitlementRequest,
  CreatePermissionRequest,
  CreateRoleRequest,
  FeatureEntitlementResponse,
  ModelEntitlementResponse,
  PermissionResponse,
  RoleResponse,
  SpringPage,
  TenantResponse,
  UpdateFeatureEntitlementRequest,
  UpdateModelEntitlementRequest,
  UpdateRoleRequest,
} from './access-types'

// The access-service roles/permissions controllers return raw Spring Page objects
// (NOT wrapped in ApiResponse), so we use a separate fetch helper.

const BASE = '/api/v1'

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const json = JSON.parse(text) as Record<string, unknown>
      msg = String(json.message ?? json.error ?? msg)
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return JSON.parse(text) as T
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return fetchWithAuth(`${BASE}${path}`, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers as Record<string, string> | undefined),
    },
  }).then(r => handleResponse<T>(r))
}

// ---- Roles ----
export const rolesApi = {
  list(search?: string, page = 0, size = 50): Promise<SpringPage<RoleResponse>> {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    if (search) q.set('search', search)
    return jsonFetch<SpringPage<RoleResponse>>(`/roles?${q}`)
  },

  get(id: string): Promise<RoleResponse> {
    return jsonFetch<RoleResponse>(`/roles/${id}`)
  },

  create(body: CreateRoleRequest): Promise<RoleResponse> {
    return jsonFetch<RoleResponse>('/roles', { method: 'POST', body: JSON.stringify(body) })
  },

  update(id: string, body: UpdateRoleRequest): Promise<RoleResponse> {
    return jsonFetch<RoleResponse>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) })
  },

  delete(id: string): Promise<void> {
    return fetchWithAuth(`${BASE}/roles/${id}`, { method: 'DELETE' }).then(r => handleResponse<void>(r))
  },

  assignPermissions(id: string, body: AssignPermissionsRequest): Promise<RoleResponse> {
    return jsonFetch<RoleResponse>(`/roles/${id}/permissions`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  removePermission(roleId: string, permissionId: string): Promise<RoleResponse> {
    return fetchWithAuth(`${BASE}/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' }).then(r => handleResponse<RoleResponse>(r))
  },
}

// ---- Permissions ----
export const permissionsApi = {
  list(search?: string, page = 0, size = 200): Promise<SpringPage<PermissionResponse>> {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    if (search) q.set('search', search)
    return jsonFetch<SpringPage<PermissionResponse>>(`/permissions?${q}`)
  },

  get(id: string): Promise<PermissionResponse> {
    return jsonFetch<PermissionResponse>(`/permissions/${id}`)
  },

  create(body: CreatePermissionRequest): Promise<PermissionResponse> {
    return jsonFetch<PermissionResponse>('/permissions', { method: 'POST', body: JSON.stringify(body) })
  },

  delete(id: string): Promise<void> {
    return fetchWithAuth(`${BASE}/permissions/${id}`, { method: 'DELETE' }).then(r => handleResponse<void>(r))
  },
}

// ---- Tenants ----
// TenantController wraps in ApiResponse<Page<TenantResponse>>, so use the main client.get()
export const tenantsApi = {
  list(search?: string, page = 0, size = 100) {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    if (search) q.set('search', search)
    return get<{ content: TenantResponse[]; totalElements: number; totalPages: number; number: number; size: number }>(
      `/tenants?${q}`,
      tokenStorage.getAccessToken() ?? '',
    )
  },
}

// ---- Feature Entitlements ----
export const featureEntitlementsApi = {
  list(tenantId: string, page = 0, size = 100): Promise<SpringPage<FeatureEntitlementResponse>> {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/feature-entitlements?${q}`).then(r => handleResponse(r))
  },

  create(tenantId: string, body: CreateFeatureEntitlementRequest): Promise<FeatureEntitlementResponse> {
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/feature-entitlements`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => handleResponse(r))
  },

  update(tenantId: string, id: string, body: UpdateFeatureEntitlementRequest): Promise<FeatureEntitlementResponse> {
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/feature-entitlements/${id}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => handleResponse(r))
  },

  delete(tenantId: string, id: string): Promise<void> {
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/feature-entitlements/${id}`, { method: 'DELETE' }).then(r => handleResponse(r))
  },
}

// ---- Model Entitlements ----
export const modelEntitlementsApi = {
  list(tenantId: string, page = 0, size = 100): Promise<SpringPage<ModelEntitlementResponse>> {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/model-entitlements?${q}`).then(r => handleResponse(r))
  },

  create(tenantId: string, body: CreateModelEntitlementRequest): Promise<ModelEntitlementResponse> {
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/model-entitlements`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => handleResponse(r))
  },

  update(tenantId: string, id: string, body: UpdateModelEntitlementRequest): Promise<ModelEntitlementResponse> {
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/model-entitlements/${id}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => handleResponse(r))
  },

  delete(tenantId: string, id: string): Promise<void> {
    return fetchWithAuth(`${BASE}/tenants/${tenantId}/model-entitlements/${id}`, { method: 'DELETE' }).then(r => handleResponse(r))
  },
}
