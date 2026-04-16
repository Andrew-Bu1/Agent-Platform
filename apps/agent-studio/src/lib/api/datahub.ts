import { tokenStorage } from './tokenStorage'
import type {
  ChunkResponse,
  CreateDatasourceRequest,
  CreateIngestionRequest,
  DatasourceResponse,
  DocumentResponse,
  IngestionResponse,
  UpdateDatasourceRequest,
} from './datahub-types'

const BASE = '/datahub'

function tok(): string {
  return tokenStorage.getAccessToken() ?? ''
}

function authHeaders(): HeadersInit {
  const t = tok()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const json = JSON.parse(text) as Record<string, string>
      msg = json.error ?? json.message ?? msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return JSON.parse(text) as T
}

// ---- Datasources ----
export const datasourcesApi = {
  list(): Promise<DatasourceResponse[]> {
    return fetch(`${BASE}/datasources`, { headers: authHeaders() }).then(r => handleResponse<DatasourceResponse[]>(r))
  },

  get(id: string): Promise<DatasourceResponse> {
    return fetch(`${BASE}/datasources/${id}`, { headers: authHeaders() }).then(r => handleResponse<DatasourceResponse>(r))
  },

  create(body: CreateDatasourceRequest): Promise<DatasourceResponse> {
    return fetch(`${BASE}/datasources`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => handleResponse<DatasourceResponse>(r))
  },

  update(id: string, body: UpdateDatasourceRequest): Promise<DatasourceResponse> {
    return fetch(`${BASE}/datasources/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => handleResponse<DatasourceResponse>(r))
  },

  delete(id: string): Promise<void> {
    return fetch(`${BASE}/datasources/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(r => handleResponse<void>(r))
  },
}

// ---- Documents ----
export const documentsApi = {
  list(datasourceId: string): Promise<DocumentResponse[]> {
    return fetch(`${BASE}/datasources/${datasourceId}/documents`, {
      headers: authHeaders(),
    }).then(r => handleResponse<DocumentResponse[]>(r))
  },

  get(id: string): Promise<DocumentResponse> {
    return fetch(`${BASE}/documents/${id}`, { headers: authHeaders() }).then(r => handleResponse<DocumentResponse>(r))
  },

  upload(datasourceId: string, file: File, metadata?: string): Promise<DocumentResponse> {
    const form = new FormData()
    form.append('file', file)
    if (metadata) form.append('metadata', metadata)
    return fetch(`${BASE}/datasources/${datasourceId}/documents`, {
      method: 'POST',
      headers: authHeaders(), // no Content-Type — browser sets multipart boundary
      body: form,
    }).then(r => handleResponse<DocumentResponse>(r))
  },

  delete(id: string): Promise<void> {
    return fetch(`${BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(r => handleResponse<void>(r))
  },
}

// ---- Ingestions ----
export const ingestionsApi = {
  list(documentId: string): Promise<IngestionResponse[]> {
    return fetch(`${BASE}/documents/${documentId}/ingestions`, {
      headers: authHeaders(),
    }).then(r => handleResponse<IngestionResponse[]>(r))
  },

  create(documentId: string, body: CreateIngestionRequest): Promise<IngestionResponse> {
    return fetch(`${BASE}/documents/${documentId}/ingestions`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => handleResponse<IngestionResponse>(r))
  },
}

// ---- Chunks ----
export const chunksApi = {
  get(id: string): Promise<ChunkResponse> {
    return fetch(`${BASE}/chunks/${id}`, { headers: authHeaders() }).then(r => handleResponse<ChunkResponse>(r))
  },
}
