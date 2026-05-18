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
  number: number;
  size: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface TenantInfo {
  id: string;
  code?: string;
  name: string;
  slug?: string;
}

export interface WorkspaceInfo {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  slug?: string;
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
  tenantId?: string | null;
  singleTenantId?: string | null;
  tenants?: TenantInfo[] | null;
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
  avatarUrl?: string | null;
  tenantId: string;
  workspaceId: string;
}

export interface SwitchRequest {
  tenantId: string;
  workspaceId: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TenantDto {
  id: string;
  code: string;
  name: string;
  status: string;
  planKey: string | null;
}

export interface WorkspaceDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
}

// ─── IAM — Members / Roles / Permissions ─────────────────────────────────────

export interface TenantMember {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  joinedAt: string;
}

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  joinedAt: string;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scopeType: string;
  isSystem: boolean;
}

export interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
  isSystem: boolean;
}

export interface InviteToTenantRequest {
  email: string;
  roleKey: string;
}

export interface InviteToWorkspaceRequest {
  email: string;
  roleKey: string;
}

export interface AssignRoleRequest {
  roleKey: string;
}

export interface CreateRoleRequest {
  key: string;
  name: string;
  description?: string;
  scopeType: 'tenant' | 'workspace';
}

export interface UpdateRoleRequest {
  name: string;
  description?: string;
}

export interface ServiceClient {
  id: string;
  tenantId: string;
  clientId: string;
  serviceName: string;
  description: string | null;
  allowedAudiences: string[];
  accessTokenTtlSeconds: number;
  isActive: boolean;
}

export interface CreateServiceClientRequest {
  clientId: string;
  serviceName: string;
  description?: string;
  allowedAudiences?: string[];
  accessTokenTtlSeconds?: number;
}

export interface UpdateServiceClientRequest {
  serviceName?: string;
  description?: string;
  allowedAudiences?: string[];
  accessTokenTtlSeconds?: number;
}

export interface ServiceClientSecretResponse {
  client: ServiceClient;
  clientSecret: string;
}

export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

export interface CreateFeatureRequest {
  key: string;
  name: string;
  description?: string;
}

export interface UpdateFeatureRequest {
  name?: string;
  description?: string;
}

export interface FeatureEntitlement {
  id: string;
  tenantId: string;
  featureId: string;
  enabled: boolean;
  config: string;
}

export interface GrantFeatureEntitlementRequest {
  featureKey: string;
  enabled?: boolean;
  config?: string;
}

export interface UpdateFeatureEntitlementRequest {
  enabled?: boolean;
  config?: string;
}

export interface ModelEntitlement {
  id: string;
  tenantId: string;
  modelKey: string;
  operationType: string;
  allowed: boolean;
  rpmLimit: number | null;
  tpmLimit: number | null;
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
  config: string;
}

export interface GrantModelEntitlementRequest {
  modelKey: string;
  operationType: string;
  allowed?: boolean;
  rpmLimit?: number;
  tpmLimit?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  config?: string;
}

export interface UpdateModelEntitlementRequest {
  allowed?: boolean;
  rpmLimit?: number;
  tpmLimit?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  config?: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  code: string;
  description?: string;
}

export interface CreateTenantRequest {
  code: string;
  name: string;
  workspaceCode: string;
  workspaceName: string;
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
  requiredPermissionKeys: string[]; // derived server-side from agentKind
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
  status?: string;
}

// ─── Flow ─────────────────────────────────────────────────────────────────────

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  status: string; // draft | active | archived
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlowVersion {
  id: string;
  flowId: string;
  version: number;
  graph: Record<string, unknown>;
  settings: Record<string, unknown> | null;
  status: string; // draft | published
  createdAt: string;
}

export interface CreateFlowRequest {
  name: string;
  description?: string;
}

export interface SaveFlowVersionRequest {
  graph: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export interface Tool {
  id: string;
  name: string;
  description: string | null;
  toolType: string;
  config: Record<string, unknown> | null;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateToolRequest {
  name: string;
  description?: string;
  toolType: string;
  config?: Record<string, unknown>;
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
  | 'waiting_for_human';

export interface Run {
  id: string;
  threadId?: string | null;
  flowVersionId: string;
  status: RunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  humanWaitTaskId?: string | null;
}

export interface NodeRun {
  id: string;
  run_id: string;
  node_id: string;
  node_type: string;
  node_name: string;
  status: string;
  branch_key: string;
  iteration: number;
  attempt_no: number;
  input_json: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  error_json: Record<string, unknown> | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface CreateRunRequest {
  threadId?: string;
  flowVersionId: string;
  input?: Record<string, unknown>;
}

export interface RunEvent {
  type: string;
  nodeId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── AIHub — Providers ────────────────────────────────────────────────────────

export interface Provider {
  id: string;
  provider_key: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  base_url: string | null;
  adapter_type: string;
  is_active: boolean;
  sort_order: number;
  has_api_key: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  provider_key: string;
  display_name: string;
  description?: string;
  logo_url?: string;
  base_url?: string;
  adapter_type?: string;
  sort_order?: number;
  api_key?: string;
}

export interface UpdateProviderRequest {
  display_name?: string;
  description?: string;
  logo_url?: string;
  base_url?: string;
  adapter_type?: string;
  is_active?: boolean;
  sort_order?: number;
  api_key?: string;
}

// ─── AIHub — Model Configs ────────────────────────────────────────────────────

export type ModelOperationType = 'chat' | 'embed' | 'rerank';

export interface ModelConfig {
  id: string;
  provider_key: string;
  model_key: string;
  display_name: string;
  description: string | null;
  provider_model_id: string;
  operation_type: ModelOperationType;
  task_type: string | null;
  endpoint_url: string | null;
  input_cost: string | null;
  output_cost: string | null;
  context_window_tokens: number | null;
  max_output_tokens: number | null;
  embedding_dimensions: number | null;
  supports_streaming: boolean;
  supports_tools: boolean;
  supports_json_mode: boolean;
  supports_vision: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateModelConfigRequest {
  provider_key: string;
  model_key: string;
  display_name: string;
  description?: string;
  provider_model_id: string;
  operation_type: ModelOperationType;
  task_type?: string;
  endpoint_url?: string;
  input_cost?: string;
  output_cost?: string;
  context_window_tokens?: number;
  max_output_tokens?: number;
  embedding_dimensions?: number;
  supports_streaming?: boolean;
  supports_tools?: boolean;
  supports_json_mode?: boolean;
  supports_vision?: boolean;
}

export interface UpdateModelConfigRequest {
  display_name?: string;
  description?: string;
  endpoint_url?: string;
  input_cost?: string;
  output_cost?: string;
  context_window_tokens?: number;
  max_output_tokens?: number;
  supports_streaming?: boolean;
  supports_tools?: boolean;
  supports_json_mode?: boolean;
  supports_vision?: boolean;
  is_active?: boolean;
}

// ─── AIHub — Model Usage Logs ─────────────────────────────────────────────────

export interface ModelUsageLog {
  id: string;
  tenant_id: string;
  workspace_id: string | null;
  user_id: string | null;
  service_client_id: string | null;
  model_id: string;
  model_key: string;
  operation_type: string;
  feature_key: string | null;
  status: 'success' | 'failed' | 'rejected' | 'timeout';
  input_tokens: number | null;
  output_tokens: number | null;
  cost: string | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface UsageByModel {
  model_key: string;
  operation_type: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  avg_latency_ms: number;
  success_count: number;
  error_count: number;
}

export interface UsageByTenant {
  tenant_id: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

export interface UsageTotals {
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  avg_latency_ms: number;
  success_count: number;
  failed_count: number;
  rejected_count: number;
  timeout_count: number;
}

export interface PlatformUsageSummary {
  totals: UsageTotals;
  by_model: UsageByModel[];
  by_tenant: UsageByTenant[];
}

// ─── DataHub — Datasources ────────────────────────────────────────────────────

export interface Datasource {
  id: string;
  tenant_id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDatasourceRequest {
  name: string;
  description?: string;
}

export interface UpdateDatasourceRequest {
  name?: string;
  description?: string;
}

// ─── DataHub — Documents ──────────────────────────────────────────────────────

export interface Document {
  id: string;
  tenant_id: string;
  workspace_id: string;
  datasource_id: string;
  name: string;
  storage_path: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── DataHub — Ingestions ─────────────────────────────────────────────────────

export interface Ingestion {
  id: string;
  tenant_id: string;
  workspace_id: string;
  document_id: string;
  chunk_strategy: string;
  chunk_config: Record<string, unknown>;
  embedding_model: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface CreateIngestionRequest {
  chunk_strategy: string;
  chunk_config: Record<string, unknown>;
  embedding_model: string;
}

// ─── DataHub — DLQ ────────────────────────────────────────────────────────────

export interface DlqEntry {
  queue: string;
  payload: string;
  error: string;
  queued_at: string;
}

export interface DlqListResponse {
  total: number;
  entries: DlqEntry[];
}
