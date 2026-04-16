import type { ApiResponse } from './types'
import { tokenStorage } from './tokenStorage'

const BASE_URL = '/api/v1'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Dispatched when a token refresh fails so that the app can redirect to /login.
export const AUTH_EXPIRED_EVENT = 'as:auth-expired'

// Prevents multiple concurrent 401 responses from each triggering a refresh.
let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

function notifyRefreshDone(token: string | null) {
  refreshQueue.forEach((resolve) => resolve(token))
  refreshQueue = []
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return null

  try {
    // Use raw fetch — NOT authApi.refresh() — to avoid deadlock.
    // At this point isRefreshing=true, so routing through request() would
    // push the refresh call itself into refreshQueue and wait forever.
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const body = await res.json() as ApiResponse<{ accessToken: string; refreshToken: string }>
    if (body.data?.accessToken) {
      tokenStorage.save(body.data.accessToken, body.data.refreshToken)
      return body.data.accessToken
    }
    return null
  } catch {
    return null
  }
}

async function rawRequest<T>(
  url: string,
  options: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const body: ApiResponse<T> = await res.json()

  if (!res.ok || !body.success) {
    throw new ApiError(res.status, body.message ?? 'An unexpected error occurred')
  }

  return body
}

async function request<T>(
  path: string,
  options: RequestInit,
  baseUrl = BASE_URL,
): Promise<ApiResponse<T>> {
  const url = `${baseUrl}${path}`

  try {
    return await rawRequest<T>(url, options)
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err

    // === 401 handling: try to refresh, then retry ===
    if (isRefreshing) {
      // Another request is already refreshing; wait for it.
      const newToken = await new Promise<string | null>((resolve) => {
        refreshQueue.push(resolve)
      })
      if (!newToken) throw err
      const retryHeaders = { ...(options.headers as Record<string, string>), Authorization: `Bearer ${newToken}` }
      return rawRequest<T>(url, { ...options, headers: retryHeaders })
    }

    isRefreshing = true
    const newToken = await tryRefresh()
    isRefreshing = false
    notifyRefreshDone(newToken)

    if (!newToken) {
      tokenStorage.clear()
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      throw err
    }

    const retryHeaders = { ...(options.headers as Record<string, string>), Authorization: `Bearer ${newToken}` }
    return rawRequest<T>(url, { ...options, headers: retryHeaders })
  }
}

/**
 * Authenticated fetch with automatic 401 → token refresh → retry.
 * Use this in API clients that don't go through the main `request()` helper
 * (datahub, aihub, access) so they also benefit from token refresh.
 *
 * Returns the raw Response — callers handle JSON parsing themselves.
 */
export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStorage.getAccessToken()
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const mergedHeaders = { ...(init.headers as Record<string, string> | undefined), ...authHeader }

  const res = await fetch(url, { ...init, headers: mergedHeaders })
  if (res.status !== 401) return res

  // 401 — attempt token refresh
  if (isRefreshing) {
    const newToken = await new Promise<string | null>(resolve => refreshQueue.push(resolve))
    if (!newToken) return res
    return fetch(url, { ...init, headers: { ...mergedHeaders, Authorization: `Bearer ${newToken}` } })
  }

  isRefreshing = true
  const newToken = await tryRefresh()
  isRefreshing = false
  notifyRefreshDone(newToken)

  if (!newToken) {
    tokenStorage.clear()
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    return res
  }

  return fetch(url, { ...init, headers: { ...mergedHeaders, Authorization: `Bearer ${newToken}` } })
}

export function post<T>(path: string, payload: unknown, token?: string, baseUrl?: string): Promise<ApiResponse<T>> {  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }, baseUrl)
}

export function get<T>(path: string, token: string, baseUrl?: string): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  }, baseUrl)
}

export function put<T>(path: string, payload: unknown, token: string, baseUrl?: string): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  }, baseUrl)
}

export function del<T>(path: string, token: string, baseUrl?: string): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }, baseUrl)
}
