// ---- Shared ----
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number // current page (0-based)
  size: number
}

// ---- Agent ----
export interface AgentResponse {
  id: string
  tenantId: string
  name: string
  description: string | null
  modelConfig: Record<string, unknown>
  memoryConfig: Record<string, unknown>
  isActive: boolean
  createdByUserId: string
  updatedByUserId: string
  createdAt: string
  updatedAt: string
}

export interface CreateAgentRequest {
  name: string
  description?: string
  modelConfig?: Record<string, unknown>
  memoryConfig?: Record<string, unknown>
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  modelConfig?: Record<string, unknown>
  memoryConfig?: Record<string, unknown>
  isActive?: boolean
}

// ---- Tool ----
export interface ToolResponse {
  id: string
  tenantId: string
  name: string
  type: string
  description: string | null
  requireApproval: boolean
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  config: Record<string, unknown>
  isActive: boolean
  createdByUserId: string
  updatedByUserId: string
  createdAt: string
  updatedAt: string
}

export interface CreateToolRequest {
  name: string
  type: string
  description?: string
  requireApproval?: boolean
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  config?: Record<string, unknown>
}

export interface UpdateToolRequest {
  name?: string
  type?: string
  description?: string
  requireApproval?: boolean
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  config?: Record<string, unknown>
  isActive?: boolean
}

// ---- Prompt Version ----
export interface PromptVersionResponse {
  id: string
  agentId: string
  version: number
  systemPrompt: string
  contextConfig: Record<string, unknown>
  isActive: boolean
  createdByUserId: string
  createdAt: string
}

export interface CreatePromptVersionRequest {
  systemPrompt: string
  contextConfig?: Record<string, unknown>
  activate?: boolean
}
