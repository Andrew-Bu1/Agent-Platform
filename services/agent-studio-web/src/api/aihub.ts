import { api } from './client';
import { useAuthStore } from '../store/authStore';
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
  AihubChatMessage,
  AihubChatResponse,
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

// ─── Chat (playground) ───────────────────────────────────────────────────────

export interface ChatParams {
  temperature?: number | null;
  top_p?: number | null;
  top_k?: number | null;
  max_tokens?: number | null;
}

export const chatApi = {
  send: (model: string, messages: AihubChatMessage[], params?: ChatParams) =>
    api.post<AihubChatResponse>('/aihub/chat', { model, messages, stream: false, ...params }),

  /** Opens an SSE stream for a chat request. Returns an EventSource-like reader. */
  stream: (model: string, messages: AihubChatMessage[], onChunk: (text: string) => void, onDone: (usage?: { prompt_tokens?: number | null; completion_tokens?: number | null }) => void, onError: (err: string) => void, params?: ChatParams): (() => void) => {
    const { accessToken } = useAuthStore.getState();
    const ctrl = new AbortController();

    fetch('/api/v1/aihub/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ model, messages, stream: true, ...params }),
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok) {
        onError(`HTTP ${res.status}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) { onError('No response body'); return; }
      const dec = new TextDecoder();
      let lastUsage: { prompt_tokens?: number | null; completion_tokens?: number | null } | undefined;
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          const raw = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
          try {
            const chunk = JSON.parse(raw);
            const content = chunk?.choices?.[0]?.delta?.content;
            if (typeof content === 'string') onChunk(content);
            if (chunk?.usage) lastUsage = chunk.usage;
          } catch { /* ignore malformed */ }
        }
      }
      onDone(lastUsage);
    }).catch((err) => {
      if (err?.name !== 'AbortError') onError(String(err));
    });

    return () => ctrl.abort();
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
