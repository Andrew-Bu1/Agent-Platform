import type { ModelConfig, ModelConfigCreate, ModelConfigUpdate } from './aihub-types'
import { ApiError, fetchWithAuth } from './client'

// AIHub FastAPI returns plain objects (no ApiResponse wrapper).
const BASE = '/aihub/v1'

async function aihubRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetchWithAuth(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  })

  if (res.status === 204) return undefined as T

  const body: unknown = await res.json()

  if (!res.ok) {
    const msg =
      typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }

  return body as T
}

export const modelConfigApi = {
  list(params?: { task_type?: string; provider?: string }) {
    const q = new URLSearchParams()
    if (params?.task_type) q.set('task_type', params.task_type)
    if (params?.provider) q.set('provider', params.provider)
    const qs = q.toString() ? `?${q.toString()}` : ''
    return aihubRequest<ModelConfig[]>(`/models${qs}`)
  },

  get(id: string) {
    return aihubRequest<ModelConfig>(`/models/${id}`)
  },

  create(body: ModelConfigCreate) {
    return aihubRequest<ModelConfig>('/models', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  update(id: string, body: ModelConfigUpdate) {
    return aihubRequest<ModelConfig>(`/models/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  delete(id: string) {
    return aihubRequest<undefined>(`/models/${id}`, { method: 'DELETE' })
  },
}
