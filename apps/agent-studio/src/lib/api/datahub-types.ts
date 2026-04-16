// ---- Datasource ----
export interface DatasourceResponse {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface CreateDatasourceRequest {
  name: string
  description?: string | null
}

export interface UpdateDatasourceRequest {
  name?: string
  description?: string | null
}

// ---- Document ----
export interface DocumentResponse {
  id: string
  datasource_id: string
  name: string
  storage_path: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ---- Ingestion ----
export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface IngestionResponse {
  id: string
  document_id: string
  chunk_strategy: string
  chunk_config: Record<string, unknown>
  embedding_model: string
  status: IngestionStatus
  created_at: string
  updated_at: string
}

export interface CreateIngestionRequest {
  chunk_strategy: string
  chunk_config: Record<string, unknown>
  embedding_model: string
}

// ---- Chunk ----
export interface ChunkResponse {
  id: string
  ingestion_id: string
  chunk_index: number
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ---- Datahub API error ----
export interface DatahubError {
  error?: string
  message?: string
}
