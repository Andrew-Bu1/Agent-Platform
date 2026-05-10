import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TokenResponse, TenantInfo, WorkspaceInfo } from '../types/api';

interface AuthState {
  // Tokens — accessToken kept in memory only; refreshToken persisted
  accessToken: string | null;
  refreshToken: string | null;

  // Context
  userId: string | null;
  tenantId: string | null;
  workspaceId: string | null;
  expiresAt: number | null; // unix ms

  // User-friendly display info (populated after login)
  selectedTenant: TenantInfo | null;
  selectedWorkspace: WorkspaceInfo | null;

  // Actions
  setTokens: (tokens: TokenResponse) => void;
  setContext: (tenant: TenantInfo, workspace: WorkspaceInfo) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      tenantId: null,
      workspaceId: null,
      expiresAt: null,
      selectedTenant: null,
      selectedWorkspace: null,

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          userId: tokens.userId,
          tenantId: tokens.tenantId,
          workspaceId: tokens.workspaceId,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        }),

      setContext: (tenant, workspace) =>
        set({ selectedTenant: tenant, selectedWorkspace: workspace }),

      clearAuth: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          tenantId: null,
          workspaceId: null,
          expiresAt: null,
          selectedTenant: null,
          selectedWorkspace: null,
        }),

      isAuthenticated: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken) return false;
        if (expiresAt && Date.now() > expiresAt) return false;
        return true;
      },
    }),
    {
      name: 'agent-studio-auth',
      // Only persist the refresh token and context identifiers;
      // access token is re-acquired on load via the refresh endpoint.
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        userId: state.userId,
        tenantId: state.tenantId,
        workspaceId: state.workspaceId,
        selectedTenant: state.selectedTenant,
        selectedWorkspace: state.selectedWorkspace,
      }),
    },
  ),
);
