import { useState, useEffect, type FormEvent } from 'react';
import {
  Users, Shield, Key, UserPlus, Trash2, Loader2, X, AlertCircle,
  CheckCircle2, ChevronDown, Plus, Crown, Building2, Layers, Pencil,
  Copy, Eye, EyeOff, RefreshCw, Power, PowerOff, Sparkles,
} from 'lucide-react';
import { iamApi } from '../api/iam';
import { ApiError } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuthStore } from '../store/authStore';
import type {
  TenantMember, WorkspaceMember, Role, Permission,
  InviteToTenantRequest, InviteToWorkspaceRequest, CreateRoleRequest,
  UpdateRoleRequest, CreateTenantRequest,
  ServiceClient, ServiceClientSecretResponse, CreateServiceClientRequest,
  Feature, FeatureEntitlement, ModelEntitlement,
  CreateFeatureRequest, UpdateFeatureRequest,
  GrantFeatureEntitlementRequest, UpdateFeatureEntitlementRequest,
  GrantModelEntitlementRequest,
} from '../types/api';

// ─── Shared small components ──────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

function RoleBadge({ roleKey, system = false }: { roleKey: string; system?: boolean }) {
  const colors: Record<string, string> = {
    platform_admin:   'bg-red-100 text-red-700',
    tenant_admin:     'bg-purple-100 text-purple-700',
    workspace_owner:  'bg-blue-100 text-blue-700',
    workspace_member: 'bg-slate-100 text-slate-700',
    agent_builder:    'bg-emerald-100 text-emerald-700',
    viewer:           'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[roleKey] ?? 'bg-indigo-100 text-indigo-700'}`}>
      {system && <Crown className="w-2.5 h-2.5" />}
      {roleKey}
    </span>
  );
}

function ScopeTag({ scope }: { scope: string }) {
  const map: Record<string, string> = {
    platform:  'bg-red-50 text-red-600',
    tenant:    'bg-purple-50 text-purple-600',
    workspace: 'bg-blue-50 text-blue-600',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${map[scope] ?? 'bg-gray-100 text-gray-500'}`}>{scope}</span>;
}

function Toast({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
      type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Role picker dropdown ─────────────────────────────────────────────────────

function RolePicker({
  roles, value, onChange,
}: {
  roles: Role[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = roles.find((r) => r.key === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full justify-between"
      >
        <span>{selected?.name ?? 'Select role…'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onChange(r.key); setOpen(false); }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${value === r.key ? 'text-brand-700 bg-brand-50' : 'text-gray-700'}`}
              >
                <span className="flex-1">{r.name}</span>
                <ScopeTag scope={r.scopeType} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Organisation Members ────────────────────────────────────────────────

function OrgMembersTab({
  tenantId, roles, onToast,
}: {
  tenantId: string;
  roles: Role[];
  onToast: (t: 'success' | 'error', m: string) => void;
}) {
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    try { setMembers(await iamApi.listTenantMembers(tenantId)); }
    catch { onToast('error', 'Failed to load members.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tenantId]);

  async function handleRemove(userId: string) {
    try {
      await iamApi.removeFromTenant(tenantId, userId);
      onToast('success', `${confirmRemove?.name ?? 'Member'} removed.`);
      setConfirmRemove(null);
      load();
    } catch { onToast('error', 'Failed to remove member.'); setConfirmRemove(null); }
  }

  async function handleRevoke(userId: string, roleKey: string) {
    try {
      await iamApi.revokeTenantRole(tenantId, userId, roleKey);
      onToast('success', `Role ${roleKey} revoked.`);
      load();
    } catch { onToast('error', 'Failed to revoke role.'); }
  }

  async function handleAssignRole(userId: string, roleKey: string) {
    try {
      await iamApi.assignTenantRole(tenantId, userId, { roleKey });
      onToast('success', `Role ${roleKey} assigned.`);
      load();
    } catch { onToast('error', 'Failed to assign role.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite member
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No members found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Roles</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <div>
                        <p className="font-medium text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {m.roles.map((r) => (
                        <button
                          key={r}
                          onClick={() => handleRevoke(m.userId, r)}
                          title={`Click to revoke ${r}`}
                          className="group flex items-center gap-1"
                        >
                          <RoleBadge roleKey={r} />
                          <X className="w-3 h-3 text-gray-300 group-hover:text-red-500 transition-colors" />
                        </button>
                      ))}
                      <div className="w-32">
                        <RolePicker
                          roles={roles.filter((r) => r.scopeType === 'tenant')}
                          value=""
                          onChange={(key) => handleAssignRole(m.userId, key)}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{new Date(m.joinedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove from organisation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <InviteTenantModal
          tenantId={tenantId}
          roles={roles.filter((r) => r.scopeType === 'tenant')}
          onClose={() => setShowInvite(false)}
          onDone={() => { setShowInvite(false); load(); onToast('success', 'Invitation sent.'); }}
          onError={(msg) => onToast('error', msg)}
        />
      )}
      {confirmRemove && (
        <ConfirmDialog
          title="Remove member"
          message={`Remove ${confirmRemove.name} from this organisation?`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(confirmRemove.userId)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

// ─── Tab: Workspace Members ───────────────────────────────────────────────────

function WorkspaceMembersTab({
  tenantId, workspaceId, roles, onToast,
}: {
  tenantId: string;
  workspaceId: string;
  roles: Role[];
  onToast: (t: 'success' | 'error', m: string) => void;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    try { setMembers(await iamApi.listWorkspaceMembers(tenantId, workspaceId)); }
    catch { onToast('error', 'Failed to load workspace members.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tenantId, workspaceId]);

  async function handleRemove(userId: string) {
    try {
      await iamApi.removeFromWorkspace(tenantId, workspaceId, userId);
      onToast('success', `${confirmRemove?.name ?? 'Member'} removed from workspace.`);
      setConfirmRemove(null);
      load();
    } catch { onToast('error', 'Failed to remove member.'); setConfirmRemove(null); }
  }

  async function handleRevoke(userId: string, roleKey: string) {
    try {
      await iamApi.revokeWorkspaceRole(tenantId, workspaceId, userId, roleKey);
      onToast('success', `Role ${roleKey} revoked.`);
      load();
    } catch { onToast('error', 'Failed to revoke role.'); }
  }

  async function handleAssignRole(userId: string, roleKey: string) {
    try {
      await iamApi.assignWorkspaceRole(tenantId, workspaceId, userId, { roleKey });
      onToast('success', `Role ${roleKey} assigned.`);
      load();
    } catch { onToast('error', 'Failed to assign role.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''} in this workspace</p>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add to workspace
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No members in this workspace.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Workspace roles</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <div>
                        <p className="font-medium text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {m.roles.map((r) => (
                        <button key={r} onClick={() => handleRevoke(m.userId, r)} title={`Revoke ${r}`} className="group flex items-center gap-1">
                          <RoleBadge roleKey={r} />
                          <X className="w-3 h-3 text-gray-300 group-hover:text-red-500 transition-colors" />
                        </button>
                      ))}
                      <div className="w-36">
                        <RolePicker
                          roles={roles.filter((r) => r.scopeType === 'workspace')}
                          value=""
                          onChange={(key) => handleAssignRole(m.userId, key)}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{new Date(m.joinedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove from workspace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <InviteWorkspaceModal
          tenantId={tenantId}
          workspaceId={workspaceId}
          roles={roles.filter((r) => r.scopeType === 'workspace')}
          existingUserIds={members.map((m) => m.userId)}
          onClose={() => setShowInvite(false)}
          onDone={() => { setShowInvite(false); load(); onToast('success', 'Member added to workspace.'); }}
          onError={(msg) => onToast('error', msg)}
        />
      )}
      {confirmRemove && (
        <ConfirmDialog
          title="Remove member"
          message={`Remove ${confirmRemove.name} from this workspace?`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(confirmRemove.userId)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

// ─── Create Tenant Modal ──────────────────────────────────────────────────────

function CreateTenantModal({
  onClose, onDone, onError,
}: {
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: CreateTenantRequest = {
        code: code.trim(),
        name: name.trim(),
        workspaceCode: workspaceCode.trim(),
        workspaceName: workspaceName.trim(),
      };
      await iamApi.createTenant(body);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create tenant.';
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Create tenant</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tenant code * <span className="text-xs text-gray-400 font-normal">(slug)</span></label>
              <input
                required autoFocus value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="acme-corp"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tenant name *</label>
              <input
                required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Default workspace code *</label>
              <input
                required value={workspaceCode}
                onChange={(e) => setWorkspaceCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="default"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Default workspace name *</label>
              <input
                required value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Default"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={loading || !code || !name || !workspaceCode || !workspaceName}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Roles ───────────────────────────────────────────────────────────────

function RolesTab({
  roles, permissions, onToast, onRefreshRoles,
}: {
  roles: Role[];
  permissions: Permission[];
  onToast: (t: 'success' | 'error', m: string) => void;
  onRefreshRoles: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rolePerms, setRolePerms] = useState<Record<string, Permission[]>>({});
  const [loadingPerms, setLoadingPerms] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<Role | null>(null);

  async function toggleRole(roleId: string) {
    if (expanded === roleId) { setExpanded(null); return; }
    setExpanded(roleId);
    if (rolePerms[roleId]) return;
    setLoadingPerms(roleId);
    try {
      setRolePerms((p) => ({ ...p, [roleId]: [] }));
      const perms = await iamApi.listRolePermissions(roleId);
      setRolePerms((p) => ({ ...p, [roleId]: perms }));
    } catch { onToast('error', 'Failed to load permissions.'); }
    finally { setLoadingPerms(null); }
  }

  async function handleDeleteRole(r: Role) {
    if (r.isSystem) { onToast('error', 'System roles cannot be deleted.'); return; }
    setConfirmDeleteRole(r);
  }

  async function executeDeleteRole(r: Role) {
    try {
      await iamApi.deleteRole(r.id);
      onToast('success', `Role "${r.name}" deleted.`);
      setConfirmDeleteRole(null);
      onRefreshRoles();
    } catch { onToast('error', 'Failed to delete role.'); setConfirmDeleteRole(null); }
  }

  async function handleRevokePermission(roleId: string, permId: string) {
    try {
      await iamApi.revokePermissionFromRole(roleId, permId);
      setRolePerms((p) => ({ ...p, [roleId]: (p[roleId] ?? []).filter((x) => x.id !== permId) }));
      onToast('success', 'Permission removed.');
    } catch { onToast('error', 'Failed to remove permission.'); }
  }

  async function handleAddPermission(roleId: string, permId: string) {
    try {
      await iamApi.assignPermissionToRole(roleId, permId);
      const perm = permissions.find((p) => p.id === permId);
      if (perm) setRolePerms((prev) => ({ ...prev, [roleId]: [...(prev[roleId] ?? []), perm] }));
      onToast('success', 'Permission added.');
    } catch { onToast('error', 'Failed to add permission.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{roles.length} role{roles.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New role
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {roles.map((role) => (
          <div key={role.id}>
            <button
              onClick={() => toggleRole(role.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{role.name}</p>
                  {role.isSystem && <span title="System role"><Crown className="w-3.5 h-3.5 text-amber-500" /></span>}
                  <ScopeTag scope={role.scopeType} />
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{role.key}</p>
                {role.description && <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!role.isSystem && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingRole(role); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title="Edit role"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete role"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded === role.id ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {expanded === role.id && (
              <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                {role.key === 'platform_admin' && (
                  <div className="flex items-center gap-3 mt-3 mb-3 pb-3 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Platform actions</p>
                    <button
                      onClick={() => setShowCreateTenant(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create tenant
                    </button>
                  </div>
                )}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-2">Permissions</p>
                {loadingPerms === role.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(rolePerms[role.id] ?? []).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => !role.isSystem && handleRevokePermission(role.id, p.id)}
                        title={role.isSystem ? p.description ?? p.key : `Click to remove ${p.key}`}
                        className={`group flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono transition-colors ${
                          role.isSystem
                            ? 'bg-white border-gray-200 text-gray-600 cursor-default'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
                        }`}
                      >
                        {p.key}
                        {!role.isSystem && <X className="w-2.5 h-2.5 text-gray-300 group-hover:text-red-500" />}
                      </button>
                    ))}
                    {!role.isSystem && (
                      <select
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) { handleAddPermission(role.id, e.target.value); e.target.value = ''; } }}
                        className="px-2 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 bg-white outline-none hover:border-brand-400 cursor-pointer"
                      >
                        <option value="">+ Add permission</option>
                        {permissions
                          .filter((p) => !(rolePerms[role.id] ?? []).find((rp) => rp.id === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.key}</option>
                          ))}
                      </select>
                    )}
                    {(rolePerms[role.id] ?? []).length === 0 && role.isSystem && (
                      <p className="text-xs text-gray-400 italic">No permissions assigned</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateRoleModal
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); onRefreshRoles(); onToast('success', 'Role created.'); }}
          onError={(msg) => onToast('error', msg)}
        />
      )}

      {editingRole && (
        <EditRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onDone={() => { setEditingRole(null); onRefreshRoles(); onToast('success', 'Role updated.'); }}
          onError={(msg) => onToast('error', msg)}
        />
      )}

      {showCreateTenant && (
        <CreateTenantModal
          onClose={() => setShowCreateTenant(false)}
          onDone={() => { setShowCreateTenant(false); onToast('success', 'Tenant created.'); }}
          onError={(msg) => onToast('error', msg)}
        />
      )}
      {confirmDeleteRole && (
        <ConfirmDialog
          title="Delete role"
          message={`Delete role "${confirmDeleteRole.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => executeDeleteRole(confirmDeleteRole)}
          onCancel={() => setConfirmDeleteRole(null)}
        />
      )}
    </div>
  );
}

// ─── Tab: API Keys ───────────────────────────────────────────────────────────

function SecretModal({
  title,
  result,
  onClose,
  onToast,
}: {
  title: string;
  result: ServiceClientSecretResponse;
  onClose: () => void;
  onToast: (t: 'success' | 'error', m: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      onToast('success', `${label} copied.`);
    } catch {
      onToast('error', `Failed to copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-amber-600 mt-0.5">The secret is shown once. Store it before closing.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client ID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 overflow-x-auto">
                {result.client.clientId}
              </code>
              <button onClick={() => copy(result.client.clientId, 'Client ID')} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client secret</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-xs text-white overflow-x-auto">
                {visible ? result.clientSecret : '•'.repeat(Math.min(48, result.clientSecret.length))}
              </code>
              <button onClick={() => setVisible((v) => !v)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50">
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => copy(result.clientSecret, 'Client secret')} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Token request</p>
            <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-mono">{`POST /api/v1/oauth/token
grant_type=client_credentials
client_id=${result.client.clientId}
client_secret=<client_secret>`}</pre>
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors">
              I saved the secret
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateApiKeyModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (result: ServiceClientSecretResponse) => void;
  onError: (m: string) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [audiences, setAudiences] = useState('studio,datahub,aihub');
  const [ttl, setTtl] = useState('3600');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseAudiences() {
    return audiences.split(',').map((a) => a.trim()).filter(Boolean);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: CreateServiceClientRequest = {
        clientId: clientId.trim(),
        serviceName: serviceName.trim(),
        description: description.trim() || undefined,
        allowedAudiences: parseAudiences(),
        accessTokenTtlSeconds: Number(ttl) || 3600,
      };
      const result = await iamApi.createServiceClient(body);
      onCreated(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create API key.';
      setError(msg);
      onError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New API key</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client ID *</label>
            <input
              required
              autoFocus
              value={clientId}
              onChange={(e) => setClientId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
              placeholder="customer-portal-client"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input required value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Customer Portal"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Allowed audiences</label>
            <input value={audiences} onChange={(e) => setAudiences(e.target.value)} placeholder="studio,datahub,aihub"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Token TTL seconds</label>
            <input value={ttl} onChange={(e) => setTtl(e.target.value.replace(/\D/g, ''))} placeholder="3600"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Where this key will be used"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !clientId.trim() || !serviceName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApiKeysTab({
  permissions,
  onToast,
}: {
  permissions: Permission[];
  onToast: (t: 'success' | 'error', m: string) => void;
}) {
  const [clients, setClients] = useState<ServiceClient[]>([]);
  const [clientPerms, setClientPerms] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadingPerms, setLoadingPerms] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [secretResult, setSecretResult] = useState<ServiceClientSecretResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    clientId: string;
    label: string;
    variant: 'danger' | 'warning';
    run: () => Promise<void>;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setClients(await iamApi.listServiceClients());
    } catch {
      onToast('error', 'Failed to load API keys.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleClient(id: string) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (!next || clientPerms[next]) return;
    setLoadingPerms(next);
    try {
      const perms = await iamApi.listServiceClientPermissions(next);
      setClientPerms((prev) => ({ ...prev, [next]: perms }));
    } catch {
      onToast('error', 'Failed to load key permissions.');
    } finally {
      setLoadingPerms(null);
    }
  }

  async function rotateSecret(client: ServiceClient) {
    setPendingConfirm({
      clientId: client.id,
      label: `Rotating the secret for "${client.serviceName}" will immediately invalidate the current secret. All services using it must be updated.`,
      variant: 'warning',
      run: async () => {
        setBusyId(client.id);
        try {
          const result = await iamApi.rotateServiceClientSecret(client.id);
          setSecretResult(result);
          setClients((prev) => prev.map((c) => (c.id === result.client.id ? result.client : c)));
        } catch (err) {
          onToast('error', err instanceof ApiError ? err.message : 'Failed to rotate secret.');
        } finally {
          setBusyId(null);
          setPendingConfirm(null);
        }
      },
    });
  }

  async function setActive(client: ServiceClient, active: boolean) {
    if (!active) {
      setPendingConfirm({
        clientId: client.id,
        label: `Deactivate "${client.serviceName}"? It will immediately stop accepting new tokens.`,
        variant: 'warning',
        run: async () => {
          setBusyId(client.id);
          try {
            const next = await iamApi.deactivateServiceClient(client.id);
            setClients((prev) => prev.map((c) => (c.id === next.id ? next : c)));
            onToast('success', 'API key deactivated.');
          } catch (err) {
            onToast('error', err instanceof ApiError ? err.message : 'Failed to deactivate API key.');
          } finally {
            setBusyId(null);
            setPendingConfirm(null);
          }
        },
      });
      return;
    }
    setBusyId(client.id);
    try {
      const next = await iamApi.activateServiceClient(client.id);
      setClients((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      onToast('success', 'API key activated.');
    } catch (err) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to activate API key.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteClient(client: ServiceClient) {
    setPendingConfirm({
      clientId: client.id,
      label: `Permanently delete API key "${client.serviceName}"? This cannot be undone.`,
      variant: 'danger',
      run: async () => {
        setBusyId(client.id);
        try {
          await iamApi.deleteServiceClient(client.id);
          setClients((prev) => prev.filter((c) => c.id !== client.id));
          onToast('success', 'API key deleted.');
        } catch (err) {
          onToast('error', err instanceof ApiError ? err.message : 'Failed to delete API key.');
        } finally {
          setBusyId(null);
          setPendingConfirm(null);
        }
      },
    });
  }

  async function addPermission(clientId: string, permissionId: string) {
    try {
      await iamApi.assignPermissionToServiceClient(clientId, permissionId);
      const permission = permissions.find((p) => p.id === permissionId);
      if (permission) setClientPerms((prev) => ({ ...prev, [clientId]: [...(prev[clientId] ?? []), permission] }));
      onToast('success', 'Permission added.');
    } catch (err) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to add permission.');
    }
  }

  async function revokePermission(clientId: string, permissionId: string) {
    try {
      await iamApi.revokePermissionFromServiceClient(clientId, permissionId);
      setClientPerms((prev) => ({ ...prev, [clientId]: (prev[clientId] ?? []).filter((p) => p.id !== permissionId) }));
      onToast('success', 'Permission removed.');
    } catch (err) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to remove permission.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{clients.length} API key{clients.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New API key
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Key className="w-9 h-9" />
            <p className="text-sm">No API keys yet.</p>
          </div>
        ) : clients.map((client) => (
          <div key={client.id}>
            <button
              onClick={() => toggleClient(client.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${client.isActive ? 'bg-amber-50' : 'bg-gray-100'}`}>
                <Key className={`w-4 h-4 ${client.isActive ? 'text-amber-600' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900 text-sm">{client.serviceName}</p>
                  {client.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{client.clientId}</p>
                {client.description && <p className="text-xs text-gray-500 mt-0.5">{client.description}</p>}
              </div>
              <div className="hidden md:flex items-center gap-1.5">
                {client.allowedAudiences.map((aud) => (
                  <span key={aud} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-mono">{aud}</span>
                ))}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded === client.id ? 'rotate-180' : ''}`} />
            </button>

            {expanded === client.id && (
              <div className="border-t border-gray-100 bg-gray-50">
                {/* Metadata */}
                <div className="grid md:grid-cols-3 gap-3 px-5 py-3 text-xs border-b border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-400 uppercase tracking-wide">Token TTL</p>
                    <p className="mt-1 text-gray-700">{client.accessTokenTtlSeconds}s</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-semibold text-gray-400 uppercase tracking-wide">Audiences</p>
                    <p className="mt-1 text-gray-700 font-mono">{client.allowedAudiences.join(', ') || 'none'}</p>
                  </div>
                </div>

                {/* Permissions */}
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Permissions</p>
                  {loadingPerms === client.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(clientPerms[client.id] ?? []).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => revokePermission(client.id, p.id)}
                          title={`Click to remove ${p.key}`}
                          className="group flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50 transition-colors"
                        >
                          {p.key}
                          <X className="w-2.5 h-2.5 text-gray-300 group-hover:text-red-500" />
                        </button>
                      ))}
                      <select
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) { addPermission(client.id, e.target.value); e.target.value = ''; } }}
                        className="px-2 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 bg-white outline-none hover:border-brand-400 cursor-pointer"
                      >
                        <option value="">+ Add permission</option>
                        {permissions
                          .filter((p) => !(clientPerms[client.id] ?? []).find((cp) => cp.id === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.key}</option>
                          ))}
                      </select>
                      {(clientPerms[client.id] ?? []).length === 0 && (
                        <p className="text-xs text-gray-400 italic">No permissions assigned</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline confirmation panel */}
                {pendingConfirm?.clientId === client.id && (
                  <div className={`mx-5 my-2 p-3 rounded-xl border flex items-start gap-3 ${
                    pendingConfirm.variant === 'danger'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                      pendingConfirm.variant === 'danger' ? 'text-red-500' : 'text-amber-500'
                    }`} />
                    <p className={`flex-1 text-xs leading-relaxed ${
                      pendingConfirm.variant === 'danger' ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {pendingConfirm.label}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setPendingConfirm(null)}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={pendingConfirm.run}
                        disabled={busyId === client.id}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                          pendingConfirm.variant === 'danger'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        {busyId === client.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

                {/* Action bar */}
                <div className="px-5 py-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => rotateSecret(client)}
                    disabled={busyId === client.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700 transition-colors disabled:opacity-50"
                  >
                    {busyId === client.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />}
                    Rotate secret
                  </button>
                  {client.isActive ? (
                    <button
                      onClick={() => setActive(client, false)}
                      disabled={busyId === client.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => setActive(client, true)}
                      disabled={busyId === client.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      <Power className="w-3.5 h-3.5" />
                      Activate
                    </button>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => deleteClient(client)}
                    disabled={busyId === client.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete key
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateApiKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(result) => {
            setShowCreate(false);
            setSecretResult(result);
            setClients((prev) => [result.client, ...prev]);
          }}
          onError={(msg) => onToast('error', msg)}
        />
      )}

      {secretResult && (
        <SecretModal
          title="API key created"
          result={secretResult}
          onClose={() => setSecretResult(null)}
          onToast={onToast}
        />
      )}
    </div>
  );
}

// ─── Invite modals ─────────────────────────────────────────────────────────────

function InviteTenantModal({
  tenantId, roles, onClose, onDone, onError,
}: {
  tenantId: string;
  roles: Role[];
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: InviteToTenantRequest = { email: email.trim(), roleKey };
      await iamApi.inviteToTenant(tenantId, body);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to invite member.';
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Invite to organisation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address *</label>
            <input
              required autoFocus type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1.5 text-xs text-gray-400">The user must already have an account.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <RolePicker roles={roles} value={roleKey} onChange={setRoleKey} />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !email || !roleKey}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteWorkspaceModal({
  tenantId, workspaceId, roles, existingUserIds, onClose, onDone, onError,
}: {
  tenantId: string;
  workspaceId: string;
  roles: Role[];
  existingUserIds: string[];
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [orgMembers, setOrgMembers] = useState<import('../types/api').TenantMember[]>([]);
  const [userId, setUserId] = useState('');
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    iamApi.listTenantMembers(tenantId).then((members) => {
      const available = members.filter((m) => !existingUserIds.includes(m.userId));
      setOrgMembers(available);
      if (available[0]) setUserId(available[0].userId);
    }).catch(() => {});
  }, [tenantId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const selected = orgMembers.find((m) => m.userId === userId);
      const body: InviteToWorkspaceRequest = { email: selected?.email ?? '', roleKey };
      await iamApi.inviteToWorkspace(tenantId, workspaceId, body);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member.';
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Add to workspace</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation member *</label>
            {orgMembers.length === 0 ? (
              <p className="text-sm text-gray-400">All organisation members are already in this workspace.</p>
            ) : (
              <select value={userId} onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white">
                {orgMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name} ({m.email})</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace role</label>
            <RolePicker roles={roles} value={roleKey} onChange={setRoleKey} />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !userId || !roleKey || orgMembers.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Add to workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateRoleModal({
  onClose, onDone, onError,
}: {
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scopeType, setScopeType] = useState<'tenant' | 'workspace'>('workspace');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: CreateRoleRequest = { key: key.trim(), name: name.trim(), description: description.trim() || undefined, scopeType };
      await iamApi.createRole(body);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create role.';
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New custom role</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Key * <span className="text-xs text-gray-400 font-normal">(unique slug)</span></label>
              <input required value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="my_custom_role"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Scope</label>
              <select value={scopeType} onChange={(e) => setScopeType(e.target.value as 'tenant' | 'workspace')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white">
                <option value="tenant">Tenant</option>
                <option value="workspace">Workspace</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="My Custom Role"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="What can members with this role do?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !key || !name}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({
  role, onClose, onDone, onError,
}: {
  role: Role;
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: UpdateRoleRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      await iamApi.updateRole(role.id, body);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update role.';
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Edit role</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Key</label>
            <input disabled value={role.key}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Entitlements ───────────────────────────────────────────────────────

function EntitlementsTab({
  tenantId,
  readOnly,
  onToast,
}: {
  tenantId: string;
  readOnly: boolean;
  onToast: (t: 'success' | 'error', m: string) => void;
}) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [featureEntitlements, setFeatureEntitlements] = useState<FeatureEntitlement[]>([]);
  const [modelEntitlements, setModelEntitlements] = useState<ModelEntitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateFeature, setShowCreateFeature] = useState(false);
  const [editFeature, setEditFeature] = useState<Feature | null>(null);
  const [showGrantFeature, setShowGrantFeature] = useState(false);
  const [showGrantModel, setShowGrantModel] = useState(false);
  const [confirmDeleteFeature, setConfirmDeleteFeature] = useState<{ id: string; key: string } | null>(null);
  const [confirmRevokeFeatureEnt, setConfirmRevokeFeatureEnt] = useState<string | null>(null);
  const [confirmRevokeModelEnt, setConfirmRevokeModelEnt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [f, fe, me] = await Promise.all([
        iamApi.listFeatures(),
        iamApi.listPlatformFeatureEntitlements(tenantId),
        iamApi.listPlatformModelEntitlements(tenantId),
      ]);
      setFeatures(f);
      setFeatureEntitlements(fe);
      setModelEntitlements(me);
    } catch {
      onToast('error', 'Failed to load entitlements.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tenantId]);

  async function handleDeleteFeature(id: string, key: string) {
    setConfirmDeleteFeature({ id, key });
  }

  async function executeDeleteFeature(id: string, key: string) {
    try {
      await iamApi.deleteFeature(id);
      onToast('success', `Feature "${key}" deleted.`);
      setConfirmDeleteFeature(null);
      load();
    } catch (err: unknown) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to delete feature.');
      setConfirmDeleteFeature(null);
    }
  }

  async function handleToggleFeatureEntitlement(fe: FeatureEntitlement) {
    try {
      await iamApi.updatePlatformFeatureEntitlement(tenantId, fe.featureId, { enabled: !fe.enabled });
      onToast('success', `Feature entitlement ${!fe.enabled ? 'enabled' : 'disabled'}.`);
      load();
    } catch (err: unknown) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to update entitlement.');
    }
  }

  async function handleRevokeFeatureEntitlement(featureId: string) {
    setConfirmRevokeFeatureEnt(featureId);
  }

  async function executeRevokeFeatureEntitlement(featureId: string) {
    try {
      await iamApi.revokePlatformFeatureEntitlement(tenantId, featureId);
      onToast('success', 'Feature entitlement revoked.');
      setConfirmRevokeFeatureEnt(null);
      load();
    } catch (err: unknown) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to revoke entitlement.');
      setConfirmRevokeFeatureEnt(null);
    }
  }

  async function handleToggleModelEntitlement(me: ModelEntitlement) {
    try {
      await iamApi.updatePlatformModelEntitlement(tenantId, me.id, { allowed: !me.allowed });
      onToast('success', `Model entitlement ${!me.allowed ? 'allowed' : 'blocked'}.`);
      load();
    } catch (err: unknown) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to update model entitlement.');
    }
  }

  async function handleRevokeModelEntitlement(id: string) {
    setConfirmRevokeModelEnt(id);
  }

  async function executeRevokeModelEntitlement(id: string) {
    try {
      await iamApi.revokePlatformModelEntitlement(tenantId, id);
      onToast('success', 'Model entitlement revoked.');
      setConfirmRevokeModelEnt(null);
      load();
    } catch (err: unknown) {
      onToast('error', err instanceof ApiError ? err.message : 'Failed to revoke model entitlement.');
      setConfirmRevokeModelEnt(null);
    }
  }

  const featureMap = new Map(features.map((f) => [f.id, f]));

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-8">
      {readOnly && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Shield className="w-4 h-4 shrink-0" />
          Entitlements are managed by the platform admin. This is a read-only view of what is enabled for your tenant.
        </div>
      )}

      {/* ── Platform Features ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Platform features</h3>
            <p className="text-sm text-gray-500 mt-0.5">Global feature registry managed by platform admins.</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowCreateFeature(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              New feature
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          {features.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No features defined.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Key</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  {!readOnly && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {features.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">{f.key}</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{f.name}</td>
                    <td className="px-5 py-3.5 text-gray-500">{f.description ?? '—'}</td>
                    {!readOnly && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditFeature(f)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFeature(f.id, f.key)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Feature Entitlements ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Feature entitlements</h3>
            <p className="text-sm text-gray-500 mt-0.5">Features granted to this tenant.</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowGrantFeature(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Grant feature
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          {featureEntitlements.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No feature entitlements granted.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Feature</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Config</th>
                  {!readOnly && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {featureEntitlements.map((fe) => {
                  const feat = featureMap.get(fe.featureId);
                  return (
                    <tr key={fe.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                            {feat?.key ?? fe.featureId}
                          </span>
                          {feat && <p className="text-xs text-gray-400 mt-1">{feat.name}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {readOnly ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${fe.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${fe.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {fe.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleFeatureEntitlement(fe)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              fe.enabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={fe.enabled ? 'Click to disable' : 'Click to enable'}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${fe.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {fe.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-400 max-w-xs truncate">{fe.config || '—'}</td>
                      {!readOnly && (
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleRevokeFeatureEntitlement(fe.featureId)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Revoke"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Model Entitlements ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Model entitlements</h3>
            <p className="text-sm text-gray-500 mt-0.5">AI model access and rate limits for this tenant.</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowGrantModel(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Grant model
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          {modelEntitlements.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No model entitlements granted.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Model key</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Operation</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">RPM / TPM</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Daily / Monthly tokens</th>
                  {!readOnly && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {modelEntitlements.map((me) => (
                  <tr key={me.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">{me.modelKey}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">{me.operationType}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {readOnly ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${me.allowed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${me.allowed ? 'bg-green-500' : 'bg-red-500'}`} />
                          {me.allowed ? 'Allowed' : 'Blocked'}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleModelEntitlement(me)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            me.allowed
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                          title={me.allowed ? 'Click to block' : 'Click to allow'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${me.allowed ? 'bg-green-500' : 'bg-red-500'}`} />
                          {me.allowed ? 'Allowed' : 'Blocked'}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {me.rpmLimit ?? '∞'} / {me.tpmLimit ?? '∞'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {me.dailyTokenLimit ?? '∞'} / {me.monthlyTokenLimit ?? '∞'}
                    </td>
                    {!readOnly && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleRevokeModelEntitlement(me.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Revoke"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Modals ── */}
      {!readOnly && showCreateFeature && (
        <FeatureFormModal
          onClose={() => setShowCreateFeature(false)}
          onDone={() => { setShowCreateFeature(false); load(); onToast('success', 'Feature created.'); }}
          onError={(m) => onToast('error', m)}
        />
      )}
      {editFeature && (
        <FeatureFormModal
          feature={editFeature}
          onClose={() => setEditFeature(null)}
          onDone={() => { setEditFeature(null); load(); onToast('success', 'Feature updated.'); }}
          onError={(m) => onToast('error', m)}
        />
      )}
      {showGrantFeature && (
        <GrantFeatureModal
          tenantId={tenantId}
          features={features}
          grantedFeatureIds={featureEntitlements.map((fe) => fe.featureId)}
          onClose={() => setShowGrantFeature(false)}
          onDone={() => { setShowGrantFeature(false); load(); onToast('success', 'Feature entitlement granted.'); }}
          onError={(m) => onToast('error', m)}
        />
      )}
      {showGrantModel && (
        <GrantModelModal
          tenantId={tenantId}
          onClose={() => setShowGrantModel(false)}
          onDone={() => { setShowGrantModel(false); load(); onToast('success', 'Model entitlement granted.'); }}
          onError={(m) => onToast('error', m)}
        />
      )}
      {confirmDeleteFeature && (
        <ConfirmDialog
          title="Delete feature"
          message={`Delete feature "${confirmDeleteFeature.key}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => executeDeleteFeature(confirmDeleteFeature.id, confirmDeleteFeature.key)}
          onCancel={() => setConfirmDeleteFeature(null)}
        />
      )}
      {confirmRevokeFeatureEnt && (
        <ConfirmDialog
          title="Revoke feature entitlement"
          message="Remove this feature entitlement from the tenant?"
          confirmLabel="Revoke"
          variant="warning"
          onConfirm={() => executeRevokeFeatureEntitlement(confirmRevokeFeatureEnt)}
          onCancel={() => setConfirmRevokeFeatureEnt(null)}
        />
      )}
      {confirmRevokeModelEnt && (
        <ConfirmDialog
          title="Revoke model entitlement"
          message="Remove this model entitlement from the tenant?"
          confirmLabel="Revoke"
          variant="warning"
          onConfirm={() => executeRevokeModelEntitlement(confirmRevokeModelEnt)}
          onCancel={() => setConfirmRevokeModelEnt(null)}
        />
      )}
    </div>
  );
}

// ─── Feature Form Modal ───────────────────────────────────────────────────────

function FeatureFormModal({
  feature,
  onClose,
  onDone,
  onError,
}: {
  feature?: Feature;
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [key, setKey] = useState(feature?.key ?? '');
  const [name, setName] = useState(feature?.name ?? '');
  const [description, setDescription] = useState(feature?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!feature;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isEdit) {
        await iamApi.updateFeature(feature.id, { name: name.trim(), description: description.trim() || undefined });
      } else {
        const body: CreateFeatureRequest = { key: key.trim(), name: name.trim() };
        if (description.trim()) body.description = description.trim();
        await iamApi.createFeature(body);
      }
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : `Failed to ${isEdit ? 'update' : 'create'} feature.`;
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Edit feature' : 'Create feature'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Key * <span className="text-xs text-gray-400 font-normal">(slug, immutable)</span></label>
              <input
                required autoFocus value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                placeholder="llm-access"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input
              required value={name} autoFocus={isEdit}
              onChange={(e) => setName(e.target.value)}
              placeholder="LLM Access"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={loading || !name.trim() || (!isEdit && !key.trim())}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create feature'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Grant Feature Modal ──────────────────────────────────────────────────────

function GrantFeatureModal({
  tenantId,
  features,
  grantedFeatureIds,
  onClose,
  onDone,
  onError,
}: {
  tenantId: string;
  features: Feature[];
  grantedFeatureIds: string[];
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const available = features.filter((f) => !grantedFeatureIds.includes(f.id));
  const [featureKey, setFeatureKey] = useState(available[0]?.key ?? '');
  const [enabled, setEnabled] = useState(true);
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: GrantFeatureEntitlementRequest = { featureKey, enabled };
      if (config.trim()) body.config = config.trim();
      await iamApi.grantPlatformFeatureEntitlement(tenantId, body);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to grant feature entitlement.';
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Grant feature entitlement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Feature *</label>
            {available.length === 0 ? (
              <p className="text-sm text-gray-400">All features are already granted to this tenant.</p>
            ) : (
              <select
                required value={featureKey}
                onChange={(e) => setFeatureKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                {available.map((f) => (
                  <option key={f.key} value={f.key}>{f.key} — {f.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm font-medium text-gray-700">Enabled immediately</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Config <span className="text-xs text-gray-400 font-normal">(optional JSON)</span></label>
            <textarea
              rows={3} value={config}
              onChange={(e) => setConfig(e.target.value)}
              placeholder="{}"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={loading || available.length === 0 || !featureKey}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Grant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Grant Model Modal ────────────────────────────────────────────────────────

function GrantModelModal({
  tenantId,
  onClose,
  onDone,
  onError,
}: {
  tenantId: string;
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [modelKey, setModelKey] = useState('');
  const [operationType, setOperationType] = useState('chat');
  const [allowed, setAllowed] = useState(true);
  const [rpmLimit, setRpmLimit] = useState('');
  const [tpmLimit, setTpmLimit] = useState('');
  const [dailyTokenLimit, setDailyTokenLimit] = useState('');
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: GrantModelEntitlementRequest = {
        modelKey: modelKey.trim(),
        operationType: operationType.trim(),
        allowed,
        ...(rpmLimit ? { rpmLimit: parseInt(rpmLimit) } : {}),
        ...(tpmLimit ? { tpmLimit: parseInt(tpmLimit) } : {}),
        ...(dailyTokenLimit ? { dailyTokenLimit: parseInt(dailyTokenLimit) } : {}),
        ...(monthlyTokenLimit ? { monthlyTokenLimit: parseInt(monthlyTokenLimit) } : {}),
      };
      await iamApi.grantPlatformModelEntitlement(tenantId, body);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to grant model entitlement.';
      setError(msg);
      onError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Grant model entitlement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Model key *</label>
            <input
              required autoFocus value={modelKey}
              onChange={(e) => setModelKey(e.target.value)}
              placeholder="gpt-4o"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Operation type *</label>
            <select
              required value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="chat">chat</option>
              <option value="embedding">embedding</option>
              <option value="completion">completion</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowed}
                onChange={(e) => setAllowed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm font-medium text-gray-700">Allowed</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">RPM limit</label>
              <input
                type="number" min={0} value={rpmLimit}
                onChange={(e) => setRpmLimit(e.target.value)}
                placeholder="∞"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">TPM limit</label>
              <input
                type="number" min={0} value={tpmLimit}
                onChange={(e) => setTpmLimit(e.target.value)}
                placeholder="∞"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily token limit</label>
              <input
                type="number" min={0} value={dailyTokenLimit}
                onChange={(e) => setDailyTokenLimit(e.target.value)}
                placeholder="∞"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly token limit</label>
              <input
                type="number" min={0} value={monthlyTokenLimit}
                onChange={(e) => setMonthlyTokenLimit(e.target.value)}
                placeholder="∞"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={loading || !modelKey.trim() || !operationType.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Grant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'org-members' | 'ws-members' | 'roles' | 'api-keys' | 'entitlements';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'org-members',   label: 'Organisation members', icon: Building2 },
  { id: 'ws-members',    label: 'Workspace members',    icon: Layers    },
  { id: 'roles',         label: 'Roles & permissions',  icon: Shield    },
  { id: 'api-keys',      label: 'API keys',             icon: Key       },
  { id: 'entitlements',  label: 'Entitlements',         icon: Sparkles  },
];

export default function AccessControlPage() {
  const { tenantId, workspaceId, userId, selectedTenant, selectedWorkspace } = useAuthStore();
  const [tab, setTab] = useState<Tab>('org-members');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadRolesAndPermissions() {
    try {
      const [r, p, members] = await Promise.all([
        iamApi.listRoles(),
        iamApi.listPermissions(),
        tenantId ? iamApi.listTenantMembers(tenantId) : Promise.resolve([]),
      ]);
      setRoles(r);
      setPermissions(p);
      const me = members.find((m) => m.userId === userId);
      setIsPlatformAdmin(me?.roles.includes('platform_admin') ?? false);
    } catch { showToast('error', 'Failed to load roles.'); }
  }

  useEffect(() => { loadRolesAndPermissions(); }, []);

  if (!tenantId || !workspaceId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No organisation selected.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Access Control</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-medium">{selectedTenant?.name}</span>
            {' · '}
            <span>{selectedWorkspace?.name}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'org-members' && (
        <OrgMembersTab tenantId={tenantId} roles={roles} onToast={showToast} />
      )}
      {tab === 'ws-members' && (
        <WorkspaceMembersTab tenantId={tenantId} workspaceId={workspaceId} roles={roles} onToast={showToast} />
      )}
      {tab === 'roles' && (
        <RolesTab roles={roles} permissions={permissions} onToast={showToast} onRefreshRoles={loadRolesAndPermissions} />
      )}
      {tab === 'api-keys' && (
        <ApiKeysTab permissions={permissions} onToast={showToast} />
      )}
      {tab === 'entitlements' && (
        <EntitlementsTab tenantId={tenantId} readOnly={!isPlatformAdmin} onToast={showToast} />
      )}

      {toast && <Toast type={toast.type} msg={toast.msg} />}
    </div>
  );
}
