import { api } from './client';
import type { Tool, CreateToolRequest, PageResponse } from '../types/api';

export const toolsApi = {
  list: (page = 0, size = 20) =>
    api.get<PageResponse<Tool>>(`/tools?page=${page}&size=${size}`),

  get: (id: string) =>
    api.get<Tool>(`/tools/${id}`),

  create: (body: CreateToolRequest) =>
    api.post<Tool>('/tools', body),

  update: (id: string, body: Partial<CreateToolRequest>) =>
    api.put<Tool>(`/tools/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/tools/${id}`),
};
