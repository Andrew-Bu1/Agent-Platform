import { api } from './client';
import type { Agent, CreateAgentRequest, UpdateAgentRequest, PageResponse } from '../types/api';

export const agentsApi = {
  list: (page = 0, size = 20) =>
    api.get<PageResponse<Agent>>(`/agents?page=${page}&size=${size}`),

  get: (id: string) =>
    api.get<Agent>(`/agents/${id}`),

  create: (body: CreateAgentRequest) =>
    api.post<Agent>('/agents', body),

  update: (id: string, body: UpdateAgentRequest) =>
    api.put<Agent>(`/agents/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/agents/${id}`),
};
