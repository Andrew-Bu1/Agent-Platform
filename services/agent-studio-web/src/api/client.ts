import { useAuthStore } from '../store/authStore';
import type { ApiResponse } from '../types/api';

const BASE = '/api/v1';

// ─── Error type ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Token refresh (singleton in-flight) ─────────────────────────────────────

let refreshing: Promise<boolean> | null = null;

export async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const json: ApiResponse<import('../types/api').TokenResponse> = await res.json();
      if (!json.success || !json.data) {
        clearAuth();
        return false;
      }
      setTokens(json.data);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const isMultipart = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  // 401 → try refresh once then retry
  if (res.status === 401 && !isRetry) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, init, true);
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
    throw new ApiError('UNAUTHORIZED', 'Session expired');
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new ApiError(json.error ?? 'UNKNOWN', json.message ?? 'An error occurred');
  }

  return json.data as T;
}

// ─── Public helpers (no auth header) ─────────────────────────────────────────

export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new ApiError(json.error ?? 'UNKNOWN', json.message ?? 'An error occurred');
  }
  return json.data as T;
}

// ─── Convenience methods ──────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** Upload a file via multipart/form-data. */
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
};

// ─── Client factory for other service bases ───────────────────────────────────
// Used by aihub.ts and datahub.ts which talk to different backends.

export function createApiClient(base: string) {
  async function serviceRequest<T>(
    path: string,
    init: RequestInit = {},
    isRetry = false,
  ): Promise<T> {
    const { accessToken } = useAuthStore.getState();

    const isMultipart = init.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers as Record<string, string>),
    };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(`${base}${path}`, { ...init, headers });

    if (res.status === 401 && !isRetry) {
      const ok = await tryRefresh();
      if (ok) return serviceRequest<T>(path, init, true);
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      throw new ApiError('UNAUTHORIZED', 'Session expired');
    }

    if (!res.ok) {
      // Services outside the BFF may return plain JSON errors, not the ApiResponse envelope.
      let message = res.statusText;
      try {
        const body = await res.clone().json();
        message = body.message ?? body.error ?? body.detail ?? message;
      } catch { /* ignore */ }
      throw new ApiError(String(res.status), message);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    get: <T>(path: string) => serviceRequest<T>(path, { method: 'GET' }),

    post: <T>(path: string, body?: unknown) =>
      serviceRequest<T>(path, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    put: <T>(path: string, body?: unknown) =>
      serviceRequest<T>(path, {
        method: 'PUT',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    patch: <T>(path: string, body?: unknown) =>
      serviceRequest<T>(path, {
        method: 'PATCH',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    delete: <T>(path: string) => serviceRequest<T>(path, { method: 'DELETE' }),

    /** Upload a file via multipart/form-data. */
    upload: <T>(path: string, formData: FormData) =>
      serviceRequest<T>(path, { method: 'POST', body: formData }),
  };
}
