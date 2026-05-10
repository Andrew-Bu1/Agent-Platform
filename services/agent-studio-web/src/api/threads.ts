import { api } from './client';
import type { Thread, CreateThreadRequest } from '../types/api';

export const threadsApi = {
  list: (limit = 20, offset = 0) =>
    api.get<Thread[]>(`/orchestrator/threads?limit=${limit}&offset=${offset}`),

  get: (id: string) =>
    api.get<Thread>(`/orchestrator/threads/${id}`),

  create: (body: CreateThreadRequest) =>
    api.post<Thread>('/orchestrator/threads', body),

  listRuns: (id: string, limit = 20, offset = 0) =>
    api.get(`/orchestrator/threads/${id}/runs?limit=${limit}&offset=${offset}`),
};
