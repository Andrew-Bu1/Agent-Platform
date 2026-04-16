import { fetchWithAuth } from './client'
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

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ---- Datasources ----
export const datasourcesApi = {
  list(): Promise<DatasourceResponse[]> {
    return fetchWithAuth(`${BASE}/datasources`).then(r => handleResponse<DatasourceResponse[]>(r))
  },

  get(id: string): Promise<DatasourceResponse> {
    return fetchWithAuth(`${BASE}/datasources/${id}`).then(r => handleResponse<DatasourceResponse>(r))
  },

  create(body: CreateDatasourceRequest): Promise<DatasourceResponse> {
    return fetchWithAuth(`${BASE}/datasources`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => handleResponse<DatasourceResponse>(r))
  },

  update(id: string, body: UpdateDatasourceRequest): Promise<DatasourceResponse> {
    return fetchWithAuth(`${BASE}/datasources/${id}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => handleResponse<DatasourceResponse>(r))
  },

  delete(id: string): Promise<void> {
    return fetchWithAuth(`${BASE}/datasources/${id}`, { method: 'DELETE' }).then(r => handleResponse<void>(r))
  },
}

// ---- Documents ----
export const documentsApi = {
  list(datasourceId: string): Promise<DocumentResponse[]> {
    return fetchWithAuth(`${BASE}/datasources/${datasourceId}/documents`).then(r => handleResponse<DocumentResponse[]>(r))
  },

  get(id: string): Promise<DocumentResponse> {
    return fetchWithAuth(`${BASE}/documents/${id}`).then(r => handleResponse<DocumentResponse>(r))
  },

  upload(datasourceId: string, file: File, metadata?: string): Promise<DocumentResponse> {
    const form = new FormData()
    form.append('file', file)
    if (metadata) form.append('metadata', metadata)
    // No Content-Type header — browser sets multipart boundary automatically
    return fetchWithAuth(`${BASE}/datasources/${datasourceId}/documents`, {
      method: 'POST',
      body: form,
    }).then(r => handleResponse<DocumentResponse>(r))
  },

  delete(id: string): Promise<void> {
    return fetchWithAuth(`${BASE}/documents/${id}`, { method: 'DELETE' }).then(r => handleResponse<void>(r))
  },
}

// ---- Ingestions ----
export const ingestionsApi = {
  list(documentId: string): Promise<IngestionResponse[]> {
    return fetchWithAuth(`${BASE}/documents/${documentId}/ingestions`).then(r => handleResponse<IngestionResponse[]>(r))
  },

  create(documentId: string, body: CreateIngestionRequest): Promise<IngestionResponse> {
    return fetchWithAuth(`${BASE}/documents/${documentId}/ingestions`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).then(r => handleResponse<IngestionResponse>(r))
  },
}

// ---- Chunks ----
export const chunksApi = {
  get(id: string): Promise<ChunkResponse> {
    return fetchWithAuth(`${BASE}/chunks/${id}`).then(r => handleResponse<ChunkResponse>(r))
  },
}
