import { api, publicPost } from './client';
import type {
  LoginRequest,
  LoginResponse,
  WorkspacesRequest,
  WorkspaceInfo,
  SwitchContextRequest,
  SwitchRequest,
  ChangePasswordRequest,
  TokenResponse,
  UserProfile,
  SignupRequest,
  SignupResponse,
  BootstrapRequest,
} from '../types/api';

export const authApi = {
  /** Create a new user account */
  signup: (body: SignupRequest) =>
    publicPost<SignupResponse>('/auth/signup', body),

  /** Bootstrap first tenant + workspace for a new user */
  bootstrap: (body: BootstrapRequest) =>
    publicPost<TokenResponse>('/tenants/bootstrap', body),

  /** Step 1 — email + password → preAuthToken + tenants */
  login: (body: LoginRequest) =>
    publicPost<LoginResponse>('/auth/login', body),

  /** Step 2 — preAuthToken + tenantId → workspaces */
  workspaces: (body: WorkspacesRequest) =>
    publicPost<WorkspaceInfo[]>('/auth/workspaces', body),

  /** Step 3 — select tenant + workspace → full JWT */
  switchContext: (body: SwitchContextRequest) =>
    publicPost<TokenResponse>('/auth/switch-context', body),

  /** Refresh access token */
  refresh: (refreshToken: string) =>
    publicPost<TokenResponse>('/auth/refresh', { refreshToken }),

  /** Logout current session */
  logoutSession: (refreshToken: string) =>
    publicPost<void>('/auth/logout/session', { refreshToken }),

  /** Logout all sessions (requires auth) */
  logoutAll: () => api.post<void>('/auth/logout'),

  /** Switch tenant + workspace while already authenticated */
  switch: (body: SwitchRequest) =>
    api.post<TokenResponse>('/auth/switch', body),

  /** Change current user's password (revokes all sessions) */
  changePassword: (body: ChangePasswordRequest) =>
    api.patch<void>('/auth/me/password', body),

  /** Get current user profile */
  me: () => api.get<UserProfile>('/auth/me'),
};
