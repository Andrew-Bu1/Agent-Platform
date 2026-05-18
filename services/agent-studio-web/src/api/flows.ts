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

  update: (id: string, body: Partial<CreateFlowRequest> & { status?: string }) =>
    api.put<Flow>(`/flows/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/flows/${id}`),

  listVersions: (id: string, page = 0, size = 20) =>
    api.get<PageResponse<FlowVersion>>(`/flows/${id}/versions?page=${page}&size=${size}`),

  getVersion: (id: string, versionId: string) =>
    api.get<FlowVersion>(`/flows/${id}/versions/${versionId}`),

  createVersion: (id: string, body: SaveFlowVersionRequest) =>
    api.post<FlowVersion>(`/flows/${id}/versions`, body),

  updateVersion: (id: string, versionId: string, body: SaveFlowVersionRequest) =>
    api.put<FlowVersion>(`/flows/${id}/versions/${versionId}`, body),

  publishVersion: (id: string, versionId: string) =>
    api.post<FlowVersion>(`/flows/${id}/versions/${versionId}/publish`),
};
