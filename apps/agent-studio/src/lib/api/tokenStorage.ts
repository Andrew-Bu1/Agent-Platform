const ACCESS_TOKEN_KEY = 'as_access_token'
const REFRESH_TOKEN_KEY = 'as_refresh_token'
const TENANTS_KEY = 'as_tenants'

export interface StoredTenant {
  id: string
  name: string
  code: string
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!b64) return null
    return JSON.parse(atob(b64)) as Record<string, unknown>
  } catch {
    return null
  }
}

export const tokenStorage = {
  save(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },

  getJwtClaims(): Record<string, unknown> | null {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    return token ? decodeJwtPayload(token) : null
  },

  getCurrentTenantId(): string | null {
    return (this.getJwtClaims()?.tenantId as string) ?? null
  },

  getCurrentUserId(): string | null {
    return (this.getJwtClaims()?.sub as string) ?? null
  },

  saveTenants(tenants: StoredTenant[]) {
    localStorage.setItem(TENANTS_KEY, JSON.stringify(tenants))
  },

  getTenants(): StoredTenant[] {
    try {
      return JSON.parse(localStorage.getItem(TENANTS_KEY) ?? '[]') as StoredTenant[]
    } catch {
      return []
    }
  },

  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TENANTS_KEY)
  },
}
