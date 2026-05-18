import { api } from './client';
import type {
  Provider,
  CreateProviderRequest,
  UpdateProviderRequest,
  ModelConfig,
  CreateModelConfigRequest,
  UpdateModelConfigRequest,
  ModelUsageLog,
  ModelOperationType,
  PlatformUsageSummary,
} from '../types/api';

// All requests go through the agent-studio BFF at /api/v1/aihub/...

// ─── Providers ────────────────────────────────────────────────────────────────

export const providersApi = {
  list: () =>
    api.get<Provider[]>('/aihub/providers'),

  get: (id: string) =>
    api.get<Provider>(`/aihub/providers/${id}`),

  create: (body: CreateProviderRequest) =>
    api.post<Provider>('/aihub/providers', body),

  update: (id: string, body: UpdateProviderRequest) =>
    api.patch<Provider>(`/aihub/providers/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/aihub/providers/${id}`),
};

// ─── Model Configs ────────────────────────────────────────────────────────────

export const modelsApi = {
  list: (params?: { operation_type?: ModelOperationType; provider_key?: string }) => {
    const qs = new URLSearchParams();
    if (params?.operation_type) qs.set('operation_type', params.operation_type);
    if (params?.provider_key) qs.set('provider_key', params.provider_key);
    const suffix = qs.size ? `?${qs}` : '';
    return api.get<ModelConfig[]>(`/aihub/models${suffix}`);
  },

  get: (id: string) =>
    api.get<ModelConfig>(`/aihub/models/${id}`),

  create: (body: CreateModelConfigRequest) =>
    api.post<ModelConfig>('/aihub/models', body),

  update: (id: string, body: UpdateModelConfigRequest) =>
    api.patch<ModelConfig>(`/aihub/models/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/aihub/models/${id}`),
};

// ─── Model Usage Logs ─────────────────────────────────────────────────────────

export const modelUsageLogsApi = {
  list: (params?: {
    model_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.model_id) qs.set('model_id', params.model_id);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    const suffix = qs.size ? `?${qs}` : '';
    return api.get<ModelUsageLog[]>(`/aihub/model-usage-logs${suffix}`);
  },
};

export const analyticsApi = {
  platformUsage: (params?: { tenant_id?: string; days?: number }) => {
    const qs = new URLSearchParams();
    if (params?.tenant_id) qs.set('tenant_id', params.tenant_id);
    if (params?.days != null) qs.set('days', String(params.days));
    const suffix = qs.size ? `?${qs}` : '';
    return api.get<PlatformUsageSummary>(`/aihub/platform/analytics/usage${suffix}`);
  },
};
