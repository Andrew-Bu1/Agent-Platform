import { api } from './client';
import { useAuthStore } from '../store/authStore';
import type { Run, CreateRunRequest } from '../types/api';

export const runsApi = {
  create: (body: CreateRunRequest) =>
    api.post<Run>('/orchestrator/runs', body),

  get: (id: string) =>
    api.get<Run>(`/orchestrator/runs/${id}`),

  cancel: (id: string) =>
    api.post<Run>(`/orchestrator/runs/${id}/cancel`),

  resume: (id: string, body: Record<string, unknown>) =>
    api.post<Run>(`/orchestrator/runs/${id}/resume`, body),

  pendingReview: () =>
    api.get<Run[]>('/orchestrator/runs/pending-review'),

  /**
   * Stream run events via SSE.
   * Uses fetch + ReadableStream because EventSource cannot send Authorization headers.
   */
  streamEvents: (
    id: string,
    onEvent: (raw: string) => void,
    onError?: (err: Error) => void,
  ): (() => void) => {
    const controller = new AbortController();

    (async () => {
      const { accessToken } = useAuthStore.getState();
      try {
        const res = await fetch(`/api/v1/orchestrator/runs/${id}/events`, {
          headers: { Authorization: `Bearer ${accessToken ?? ''}` },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          onError?.(new Error(`SSE connect failed: ${res.status}`));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (part.trim()) onEvent(part);
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError?.(err as Error);
        }
      }
    })();

    return () => controller.abort();
  },
};
