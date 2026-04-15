import { get, post, put, del } from './client'
import { tokenStorage } from './tokenStorage'
import type {
  AgentResponse,
  CreateAgentRequest,
  CreatePromptVersionRequest,
  CreateToolRequest,
  PageResponse,
  PromptVersionResponse,
  ToolResponse,
  UpdateAgentRequest,
  UpdateToolRequest,
} from './studio-types'

const BASE = '/studio/api/v1'

function tok(): string {
  return tokenStorage.getAccessToken() ?? ''
}

// ---- Agents ----
const agentsApi = {
  list(search?: string, page = 0, size = 20) {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    if (search) q.set('search', search)
    return get<PageResponse<AgentResponse>>(`/agents?${q}`, tok(), BASE)
  },
  get(id: string) {
    return get<AgentResponse>(`/agents/${id}`, tok(), BASE)
  },
  create(req: CreateAgentRequest) {
    return post<AgentResponse>('/agents', req, tok(), BASE)
  },
  update(id: string, req: UpdateAgentRequest) {
    return put<AgentResponse>(`/agents/${id}`, req, tok(), BASE)
  },
  delete(id: string) {
    return del<void>(`/agents/${id}`, tok(), BASE)
  },
  getTools(agentId: string) {
    return get<ToolResponse[]>(`/agents/${agentId}/tools`, tok(), BASE)
  },
  addTool(agentId: string, toolId: string) {
    return post<void>(`/agents/${agentId}/tools/${toolId}`, {}, tok(), BASE)
  },
  removeTool(agentId: string, toolId: string) {
    return del<void>(`/agents/${agentId}/tools/${toolId}`, tok(), BASE)
  },
}

// ---- Tools ----
const toolsApi = {
  list(search?: string, page = 0, size = 20) {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    if (search) q.set('search', search)
    return get<PageResponse<ToolResponse>>(`/tools?${q}`, tok(), BASE)
  },
  get(id: string) {
    return get<ToolResponse>(`/tools/${id}`, tok(), BASE)
  },
  create(req: CreateToolRequest) {
    return post<ToolResponse>('/tools', req, tok(), BASE)
  },
  update(id: string, req: UpdateToolRequest) {
    return put<ToolResponse>(`/tools/${id}`, req, tok(), BASE)
  },
  delete(id: string) {
    return del<void>(`/tools/${id}`, tok(), BASE)
  },
}

// ---- Prompts ----
const promptsApi = {
  list(agentId: string) {
    return get<PromptVersionResponse[]>(`/agents/${agentId}/prompts`, tok(), BASE)
  },
  get(agentId: string, id: string) {
    return get<PromptVersionResponse>(`/agents/${agentId}/prompts/${id}`, tok(), BASE)
  },
  create(agentId: string, req: CreatePromptVersionRequest) {
    return post<PromptVersionResponse>(`/agents/${agentId}/prompts`, req, tok(), BASE)
  },
  activate(agentId: string, id: string) {
    return post<PromptVersionResponse>(`/agents/${agentId}/prompts/${id}/activate`, {}, tok(), BASE)
  },
  delete(agentId: string, id: string) {
    return del<void>(`/agents/${agentId}/prompts/${id}`, tok(), BASE)
  },
}

export { agentsApi, toolsApi, promptsApi }

