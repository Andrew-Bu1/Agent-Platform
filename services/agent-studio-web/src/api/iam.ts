import { api } from './client';
import type {
  TenantDto,
  WorkspaceDto,
  TenantMember,
  WorkspaceMember,
  Role,
  Permission,
  InviteToTenantRequest,
  InviteToWorkspaceRequest,
  AssignRoleRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  CreateWorkspaceRequest,
  CreateTenantRequest,
  CreateServiceClientRequest,
  UpdateServiceClientRequest,
  ServiceClient,
  ServiceClientSecretResponse,
  Feature,
  CreateFeatureRequest,
  UpdateFeatureRequest,
  FeatureEntitlement,
  GrantFeatureEntitlementRequest,
  UpdateFeatureEntitlementRequest,
  ModelEntitlement,
  GrantModelEntitlementRequest,
  UpdateModelEntitlementRequest,
} from '../types/api';

export const iamApi = {
  // ── Tenants ────────────────────────────────────────────────────────────────
  listTenants: () =>
    api.get<TenantDto[]>('/tenants'),

  createTenant: (body: CreateTenantRequest) =>
    api.post<TenantDto>('/tenants', body),

  listWorkspaces: (tenantId: string) =>
    api.get<WorkspaceDto[]>(`/tenants/${tenantId}/workspaces`),

  createWorkspace: (tenantId: string, body: CreateWorkspaceRequest) =>
    api.post<WorkspaceDto>(`/tenants/${tenantId}/workspaces`, body),

  // ── Tenant members ─────────────────────────────────────────────────────────
  listTenantMembers: (tenantId: string) =>
    api.get<TenantMember[]>(`/tenants/${tenantId}/members`),

  inviteToTenant: (tenantId: string, body: InviteToTenantRequest) =>
    api.post<TenantMember>(`/tenants/${tenantId}/members`, body),

  removeFromTenant: (tenantId: string, userId: string) =>
    api.delete<void>(`/tenants/${tenantId}/members/${userId}`),

  assignTenantRole: (tenantId: string, userId: string, body: AssignRoleRequest) =>
    api.post<void>(`/tenants/${tenantId}/members/${userId}/roles`, body),

  revokeTenantRole: (tenantId: string, userId: string, roleKey: string) =>
    api.delete<void>(`/tenants/${tenantId}/members/${userId}/roles/${roleKey}`),

  // ── Workspace members ──────────────────────────────────────────────────────
  listWorkspaceMembers: (tenantId: string, workspaceId: string) =>
    api.get<WorkspaceMember[]>(`/tenants/${tenantId}/workspaces/${workspaceId}/members`),

  inviteToWorkspace: (tenantId: string, workspaceId: string, body: InviteToWorkspaceRequest) =>
    api.post<WorkspaceMember>(`/tenants/${tenantId}/workspaces/${workspaceId}/members`, body),

  removeFromWorkspace: (tenantId: string, workspaceId: string, userId: string) =>
    api.delete<void>(`/tenants/${tenantId}/workspaces/${workspaceId}/members/${userId}`),

  assignWorkspaceRole: (tenantId: string, workspaceId: string, userId: string, body: AssignRoleRequest) =>
    api.post<void>(`/tenants/${tenantId}/workspaces/${workspaceId}/members/${userId}/roles`, body),

  revokeWorkspaceRole: (tenantId: string, workspaceId: string, userId: string, roleKey: string) =>
    api.delete<void>(`/tenants/${tenantId}/workspaces/${workspaceId}/members/${userId}/roles/${roleKey}`),

  // ── Roles ──────────────────────────────────────────────────────────────────
  listRoles: () =>
    api.get<Role[]>('/roles'),

  getRole: (roleId: string) =>
    api.get<Role>(`/roles/${roleId}`),

  createRole: (body: CreateRoleRequest) =>
    api.post<Role>('/roles', body),

  updateRole: (roleId: string, body: UpdateRoleRequest) =>
    api.patch<Role>(`/roles/${roleId}`, body),

  deleteRole: (roleId: string) =>
    api.delete<void>(`/roles/${roleId}`),

  listRolePermissions: (roleId: string) =>
    api.get<Permission[]>(`/roles/${roleId}/permissions`),

  assignPermissionToRole: (roleId: string, permissionId: string) =>
    api.post<void>(`/roles/${roleId}/permissions`, { permissionId }),

  revokePermissionFromRole: (roleId: string, permissionId: string) =>
    api.delete<void>(`/roles/${roleId}/permissions/${permissionId}`),

  // ── Permissions ────────────────────────────────────────────────────────────
  listPermissions: () =>
    api.get<Permission[]>('/permissions'),

  myPermissions: () =>
    api.get<Permission[]>('/permissions/me'),

  // ── Service clients / client API keys ─────────────────────────────────────
  listServiceClients: () =>
    api.get<ServiceClient[]>('/service-clients'),

  getServiceClient: (id: string) =>
    api.get<ServiceClient>(`/service-clients/${id}`),

  createServiceClient: (body: CreateServiceClientRequest) =>
    api.post<ServiceClientSecretResponse>('/service-clients', body),

  updateServiceClient: (id: string, body: UpdateServiceClientRequest) =>
    api.patch<ServiceClient>(`/service-clients/${id}`, body),

  rotateServiceClientSecret: (id: string) =>
    api.post<ServiceClientSecretResponse>(`/service-clients/${id}/rotate-secret`),

  activateServiceClient: (id: string) =>
    api.patch<ServiceClient>(`/service-clients/${id}/activate`),

  deactivateServiceClient: (id: string) =>
    api.patch<ServiceClient>(`/service-clients/${id}/deactivate`),

  deleteServiceClient: (id: string) =>
    api.delete<void>(`/service-clients/${id}`),

  listServiceClientPermissions: (id: string) =>
    api.get<Permission[]>(`/service-clients/${id}/permissions`),

  assignPermissionToServiceClient: (id: string, permissionId: string) =>
    api.post<void>(`/service-clients/${id}/permissions`, { permissionId }),

  revokePermissionFromServiceClient: (id: string, permissionId: string) =>
    api.delete<void>(`/service-clients/${id}/permissions/${permissionId}`),

  // ── Platform admin: features + tenant entitlements ────────────────────────
  listFeatures: () =>
    api.get<Feature[]>('/features'),

  createFeature: (body: CreateFeatureRequest) =>
    api.post<Feature>('/features', body),

  updateFeature: (id: string, body: UpdateFeatureRequest) =>
    api.patch<Feature>(`/features/${id}`, body),

  deleteFeature: (id: string) =>
    api.delete<void>(`/features/${id}`),

  listPlatformTenants: () =>
    api.get<TenantDto[]>('/platform/tenants'),

  listPlatformTenantWorkspaces: (tenantId: string) =>
    api.get<WorkspaceDto[]>(`/platform/tenants/${tenantId}/workspaces`),

  listPlatformTenantRoles: (tenantId: string) =>
    api.get<Role[]>(`/platform/tenants/${tenantId}/roles`),

  listPlatformTenantPermissions: (tenantId: string) =>
    api.get<Permission[]>(`/platform/tenants/${tenantId}/permissions`),

  listPlatformFeatureEntitlements: (tenantId: string) =>
    api.get<FeatureEntitlement[]>(`/platform/tenants/${tenantId}/entitlements/features`),

  grantPlatformFeatureEntitlement: (tenantId: string, body: GrantFeatureEntitlementRequest) =>
    api.post<FeatureEntitlement>(`/platform/tenants/${tenantId}/entitlements/features`, body),

  updatePlatformFeatureEntitlement: (tenantId: string, featureId: string, body: UpdateFeatureEntitlementRequest) =>
    api.patch<FeatureEntitlement>(`/platform/tenants/${tenantId}/entitlements/features/${featureId}`, body),

  revokePlatformFeatureEntitlement: (tenantId: string, featureId: string) =>
    api.delete<void>(`/platform/tenants/${tenantId}/entitlements/features/${featureId}`),

  listPlatformModelEntitlements: (tenantId: string) =>
    api.get<ModelEntitlement[]>(`/platform/tenants/${tenantId}/entitlements/models`),

  grantPlatformModelEntitlement: (tenantId: string, body: GrantModelEntitlementRequest) =>
    api.post<ModelEntitlement>(`/platform/tenants/${tenantId}/entitlements/models`, body),

  updatePlatformModelEntitlement: (tenantId: string, id: string, body: UpdateModelEntitlementRequest) =>
    api.patch<ModelEntitlement>(`/platform/tenants/${tenantId}/entitlements/models/${id}`, body),

  revokePlatformModelEntitlement: (tenantId: string, id: string) =>
    api.delete<void>(`/platform/tenants/${tenantId}/entitlements/models/${id}`),
};
