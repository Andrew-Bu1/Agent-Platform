import { api } from './client';
import type {
  Flow,
  FlowVersion,
  CreateFlowRequest,
  SaveFlowVersionRequest,
  PageResponse,
} from '../types/api';

export const flowsApi = {
  list: (page = 0, size = 20) =>
    api.get<PageResponse<Flow>>(`/flows?page=${page}&size=${size}`),

  get: (id: string) =>
    api.get<Flow>(`/flows/${id}`),

  create: (body: CreateFlowRequest) =>
    api.post<Flow>('/flows', body),

  update: (id: string, body: Partial<CreateFlowRequest>) =>
    api.put<Flow>(`/flows/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/flows/${id}`),

  publish: (id: string) =>
    api.post<Flow>(`/flows/${id}/publish`),

  listVersions: (id: string) =>
    api.get<FlowVersion[]>(`/flows/${id}/versions`),

  getVersion: (id: string, version: number) =>
    api.get<FlowVersion>(`/flows/${id}/versions/${version}`),

  saveVersion: (id: string, body: SaveFlowVersionRequest) =>
    api.post<FlowVersion>(`/flows/${id}/versions`, body),
};
