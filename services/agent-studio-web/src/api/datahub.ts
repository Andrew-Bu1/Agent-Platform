import { api } from './client';
import type {
  Datasource,
  CreateDatasourceRequest,
  UpdateDatasourceRequest,
  Document,
  Ingestion,
  CreateIngestionRequest,
  DlqEntry,
  DlqListResponse,
} from '../types/api';

// All requests go through the agent-studio BFF at /api/v1/datahub/...

// ─── Datasources ──────────────────────────────────────────────────────────────

export const datasourcesApi = {
  list: () =>
    api.get<Datasource[]>('/datahub/datasources'),

  get: (id: string) =>
    api.get<Datasource>(`/datahub/datasources/${id}`),

  create: (body: CreateDatasourceRequest) =>
    api.post<Datasource>('/datahub/datasources', body),

  update: (id: string, body: UpdateDatasourceRequest) =>
    api.put<Datasource>(`/datahub/datasources/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/datahub/datasources/${id}`),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentsApi = {
  listByDatasource: (datasourceId: string) =>
    api.get<Document[]>(`/datahub/datasources/${datasourceId}/documents`),

  get: (id: string) =>
    api.get<Document>(`/datahub/documents/${id}`),

  /**
   * Upload a file into a datasource via the BFF (multipart/form-data).
   * @param metadata Optional arbitrary JSON object attached to the document.
   */
  upload: (datasourceId: string, file: File, metadata?: Record<string, unknown>) => {
    const form = new FormData();
    form.append('file', file);
    if (metadata !== undefined) {
      form.append('metadata', JSON.stringify(metadata));
    }
    return api.upload<Document>(`/datahub/datasources/${datasourceId}/documents`, form);
  },

  delete: (id: string) =>
    api.delete<void>(`/datahub/documents/${id}`),
};

// ─── Ingestions ───────────────────────────────────────────────────────────────

export const ingestionsApi = {
  listByDocument: (documentId: string) =>
    api.get<Ingestion[]>(`/datahub/documents/${documentId}/ingestions`),

  get: (id: string) =>
    api.get<Ingestion>(`/datahub/ingestions/${id}`),

  /**
   * Trigger ingestion (chunking + embedding) for a document.
   */
  trigger: (documentId: string, body: CreateIngestionRequest) =>
    api.post<Ingestion>(`/datahub/documents/${documentId}/ingestions`, body),
};

// ─── DLQ Admin ────────────────────────────────────────────────────────────────

export const dlqApi = {
  list: (limit = 100) =>
    api.get<DlqListResponse>(`/datahub/ingestions/dlq?limit=${limit}`),

  replay: () =>
    api.post<{ replayed: number }>('/datahub/ingestions/dlq/replay', {}),

  clear: () =>
    api.delete<void>('/datahub/ingestions/dlq'),
};
