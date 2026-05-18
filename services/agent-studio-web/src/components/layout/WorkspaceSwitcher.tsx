import { useState, useEffect, useRef } from 'react';
import { ChevronsUpDown, Check, Building2, Layers, Loader2, Plus, Eye } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { iamApi } from '../../api/iam';
import type { TenantDto, WorkspaceDto } from '../../types/api';

type View = 'workspaces' | 'tenants';

export default function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { selectedTenant, selectedWorkspace, setTokens, setContext, tenantId, workspaceId, userId } =
    useAuthStore();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('workspaces');
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [browsingTenant, setBrowsingTenant] = useState<TenantDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  // Create workspace form
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreateForm(false);
        setNewWsName('');
        setNewWsDesc('');
        setCreateError(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function openSwitcher() {
    setOpen((o) => !o);
    if (open) {
      setShowCreateForm(false);
      setNewWsName('');
      setNewWsDesc('');
      setCreateError(null);
      return;
    }
    setView('workspaces');
    setLoading(true);
    try {
      // Try platform admin tenant list first; fall back to member-scoped list for regular users
      let allTenants: TenantDto[];
      let isAdmin = false;
      try {
        allTenants = await iamApi.listPlatformTenants();
        isAdmin = true;
      } catch {
        allTenants = await iamApi.listTenants();
      }
      setIsPlatformAdmin(isAdmin);

      const [ws, members] = await Promise.all([
        tenantId ? iamApi.listWorkspaces(tenantId) : Promise.resolve([]),
        tenantId ? iamApi.listTenantMembers(tenantId) : Promise.resolve([]),
      ]);
      setWorkspaces(Array.isArray(ws) ? ws : []);
      setTenants(Array.isArray(allTenants) ? allTenants : []);
      const me = Array.isArray(members) ? members.find((m) => m.userId === userId) : null;
      setIsTenantAdmin(me?.roles.includes('tenant_admin') ?? false);
    } catch {
      // ignore — keep dropdown open with empty lists
    } finally {
      setLoading(false);
    }
  }

  async function browseTenantWorkspaces(tenant: TenantDto) {
    setBrowsingTenant(tenant);
    setView('workspaces');
    setLoading(true);
    try {
      // Platform admins use the cross-tenant endpoint for tenants they're not a member of
      const ws = isPlatformAdmin && tenant.id !== tenantId
        ? await iamApi.listPlatformTenantWorkspaces(tenant.id)
        : await iamApi.listWorkspaces(tenant.id);
      setWorkspaces(Array.isArray(ws) ? ws : []);
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }

  async function switchTo(ws: WorkspaceDto) {    const targetTenant = browsingTenant ?? tenants.find((t) => t.id === tenantId)
      ?? (tenantId ? { id: tenantId, code: selectedTenant?.code ?? '', name: selectedTenant?.name ?? '', planKey: null, status: '' } : null);
    if (!targetTenant) return;
    setSwitching(ws.id);
    try {
      const tokens = await authApi.switch({ tenantId: targetTenant.id, workspaceId: ws.id });
      setTokens(tokens);
      setContext(
        { id: targetTenant.id, name: targetTenant.name, slug: targetTenant.code },
        { id: ws.id, name: ws.name, slug: ws.code },
      );
      setOpen(false);
      window.location.href = '/';
    } catch {
      // keep switcher open so user can retry
    } finally {
      setSwitching(null);
    }
  }

  async function handleCreateWorkspace() {
    if (!tenantId || !newWsName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const code = newWsName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const created = await iamApi.createWorkspace(tenantId, {
        name: newWsName.trim(),
        code,
        description: newWsDesc.trim() || undefined,
      });
      // Refresh list then auto-switch
      const ws = await iamApi.listWorkspaces(tenantId);
      setWorkspaces(Array.isArray(ws) ? ws : []);
      setShowCreateForm(false);
      setNewWsName('');
      setNewWsDesc('');
      await switchTo(created);
    } catch {
      setCreateError('Failed to create workspace. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function cancelCreateForm() {
    setShowCreateForm(false);
    setNewWsName('');
    setNewWsDesc('');
    setCreateError(null);
  }

  const displayTenant = selectedTenant?.name ?? 'Organisation';
  const displayWorkspace = selectedWorkspace?.name ?? 'Workspace';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openSwitcher}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-left group ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <div className="w-7 h-7 rounded-md bg-brand-600/80 flex items-center justify-center shrink-0 text-white text-xs font-bold uppercase">
          {displayWorkspace.charAt(0)}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 truncate leading-none mb-0.5">
                {displayTenant}
              </p>
              <p className="text-sm font-medium text-slate-100 truncate leading-none">
                {displayWorkspace}
              </p>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setView('workspaces')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                view === 'workspaces'
                  ? 'text-brand-600 border-b-2 border-brand-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Workspaces
            </button>
            <button
              onClick={() => { setView('tenants'); setBrowsingTenant(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                view === 'tenants'
                  ? 'text-brand-600 border-b-2 border-brand-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Organisations
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : view === 'workspaces' ? (
              <>
                {browsingTenant && browsingTenant.id !== tenantId && (
                  <div className="px-3 pt-2.5 pb-1">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {browsingTenant.name}
                    </p>
                  </div>
                )}
                {workspaces.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No workspaces found</p>
                ) : (
                  workspaces.map((ws) => {
                    const effectiveTenantId = browsingTenant?.id ?? tenantId;
                    const isActive = ws.id === workspaceId && effectiveTenantId === tenantId;
                    const isReadOnly = isPlatformAdmin && !!browsingTenant && browsingTenant.id !== tenantId;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => !isReadOnly && switchTo(ws)}
                        disabled={switching === ws.id || isReadOnly}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                          isReadOnly ? 'cursor-default opacity-60' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-6 h-6 rounded bg-brand-100 flex items-center justify-center text-brand-700 text-[10px] font-bold uppercase shrink-0">
                          {ws.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{ws.name}</p>
                          {ws.description && (
                            <p className="text-xs text-gray-400 truncate">{ws.description}</p>
                          )}
                        </div>
                        {switching === ws.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500 shrink-0" />
                        ) : isReadOnly ? (
                          <Eye className="w-3.5 h-3.5 text-gray-300 shrink-0" title="View only" />
                        ) : isActive ? (
                          <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </>
            ) : (
              tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => browseTenantWorkspaces(t)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400 truncate">{t.code}</p>
                  </div>
                  {t.id === tenantId && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                </button>
              ))
            )}
          </div>

          {/* Create workspace — only for tenant_admin in their own tenant */}
          {view === 'workspaces' && isTenantAdmin && (!browsingTenant || browsingTenant.id === tenantId) && (
            showCreateForm ? (
              <div className="px-3 py-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-2">New workspace</p>
                <input
                  autoFocus
                  type="text"
                  placeholder="Workspace name"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                  className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 mb-1.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                  className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 mb-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                {createError && (
                  <p className="text-xs text-red-500 mb-1.5">{createError}</p>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateWorkspace}
                    disabled={creating || !newWsName.trim()}
                    className="flex-1 text-xs bg-brand-600 text-white rounded-md py-1.5 font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                  >
                    {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
                  </button>
                  <button
                    onClick={cancelCreateForm}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-100">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-brand-600 hover:bg-brand-50 transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New workspace
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
