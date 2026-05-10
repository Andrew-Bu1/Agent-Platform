// ─── Generic envelope ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  userId: string;
  email: string;
  name: string;
}

export interface BootstrapRequest {
  preAuthToken: string;
  tenantCode: string;
  tenantName: string;
  workspaceCode: string;
  workspaceName: string;
}

/** Step 1 — POST /api/v1/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  preAuthToken: string;
  requireTenantCreation: boolean;
  requireTenantSelection: boolean;
  singleTenantId: string | null;
  tenants: TenantInfo[];
}

/** Step 2 — POST /api/v1/auth/workspaces */
export interface WorkspacesRequest {
  preAuthToken: string;
  tenantId: string;
}

/** Step 3 — POST /api/v1/auth/switch-context */
export interface SwitchContextRequest {
  preAuthToken: string;
  tenantId: string;
  workspaceId: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  tenantId: string;
  workspaceId: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  agentKind: string;
  definition: Record<string, unknown>;
  toolIds: string[];
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  agentKind: string;
  definition?: Record<string, unknown>;
  toolIds?: string[];
  modelId?: string;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  agentKind?: string;
  definition?: Record<string, unknown>;
  toolIds?: string[];
  modelId?: string;
}

// ─── Flow ─────────────────────────────────────────────────────────────────────

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  publishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlowVersion {
  id: string;
  flowId: string;
  version: number;
  graphJson: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
}

export interface CreateFlowRequest {
  name: string;
  description?: string;
}

export interface SaveFlowVersionRequest {
  graphJson: Record<string, unknown>;
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export interface Tool {
  id: string;
  name: string;
  description: string | null;
  toolKind: string;
  definition: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateToolRequest {
  name: string;
  description?: string;
  toolKind: string;
  definition?: Record<string, unknown>;
}

// ─── Thread ───────────────────────────────────────────────────────────────────

export interface Thread {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateThreadRequest {
  title?: string;
  metadata?: Record<string, unknown>;
}

// ─── Run ──────────────────────────────────────────────────────────────────────

export type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'pending_human_review';

export interface Run {
  id: string;
  threadId: string;
  flowVersionId: string;
  status: RunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunRequest {
  threadId: string;
  flowVersionId: string;
  input?: Record<string, unknown>;
}

export interface RunEvent {
  type: string;
  nodeId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}
