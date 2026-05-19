import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Database,
  Key,
  Loader2,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { iamApi } from '../api/iam';
import { modelsApi } from '../api/aihub';
import ConfirmDialog from '../components/ConfirmDialog';
import type {
  Feature,
  FeatureEntitlement,
  ModelConfig,
  ModelEntitlement,
  TenantDto,
  WorkspaceDto,
} from '../types/api';

function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
      type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-red-200 bg-red-50 text-red-700'
    }`}>
      {type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FeatureCatalog({
  features,
  onRefresh,
  onToast,
}: {
  features: Feature[];
  onRefresh: () => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function createFeature(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await iamApi.createFeature({
        key: key.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setKey('');
      setName('');
      setDescription('');
      onToast('success', 'Feature created.');
      onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to create feature.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Feature catalog" description="Platform capabilities that can be entitled to tenants.">
      <form onSubmit={createFeature} className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto]">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
          placeholder="feature_key"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:border-brand-400"
          required
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          required
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <button
          disabled={saving || !key || !name}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {features.map((feature) => (
          <span key={feature.id} className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs">
            <span className="font-medium text-gray-800">{feature.name}</span>
            <span className="ml-2 font-mono text-gray-400">{feature.key}</span>
          </span>
        ))}
        {features.length === 0 && <p className="text-sm text-gray-400">No features configured.</p>}
      </div>
    </Section>
  );
}

function TenantPanel({
  tenant,
  workspaces,
}: {
  tenant: TenantDto | null;
  workspaces: WorkspaceDto[];
}) {
  return (
    <Section title="Tenant" description="Selected tenant context for entitlement management.">
      {!tenant ? (
        <p className="text-sm text-gray-400">Select a tenant.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Name</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{tenant.name}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Code</p>
              <p className="mt-1 font-mono text-sm text-gray-700">{tenant.code}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Plan</p>
              <p className="mt-1 text-sm text-gray-700">{tenant.planKey ?? 'none'}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Workspaces</p>
            <div className="flex flex-wrap gap-2">
              {workspaces.map((workspace) => (
                <span key={workspace.id} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600">
                  {workspace.name}
                </span>
              ))}
              {workspaces.length === 0 && <span className="text-xs text-gray-400">No active workspaces.</span>}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function FeatureEntitlements({
  tenantId,
  features,
  entitlements,
  onRefresh,
  onToast,
}: {
  tenantId: string | null;
  features: Feature[];
  entitlements: FeatureEntitlement[];
  onRefresh: () => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [confirmRevoke, setConfirmRevoke] = useState<Feature | null>(null);

  async function toggle(feature: Feature, entitlement?: FeatureEntitlement) {
    if (!tenantId) return;
    try {
      if (!entitlement) {
        await iamApi.grantPlatformFeatureEntitlement(tenantId, {
          featureKey: feature.key,
          enabled: true,
          config: '{}',
        });
      } else {
        await iamApi.updatePlatformFeatureEntitlement(tenantId, feature.id, {
          enabled: !entitlement.enabled,
          config: entitlement.config ?? '{}',
        });
      }
      onToast('success', 'Feature entitlement updated.');
      onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to update feature entitlement.');
    }
  }

  async function revoke(feature: Feature) {
    if (!tenantId) return;
    try {
      await iamApi.revokePlatformFeatureEntitlement(tenantId, feature.id);
      onToast('success', 'Feature entitlement removed.');
      setConfirmRevoke(null);
      onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to remove feature entitlement.');
      setConfirmRevoke(null);
    }
  }

  return (
    <Section title="Feature entitlements" description="Enable or disable platform capabilities for the selected tenant.">
      <div className="grid gap-2 md:grid-cols-2">
        {features.map((feature) => {
          const entitlement = entitlements.find((item) => item.featureId === feature.id);
          return (
            <div key={feature.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
              <Shield className={`h-4 w-4 ${entitlement?.enabled ? 'text-emerald-600' : 'text-gray-300'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{feature.name}</p>
                <p className="truncate font-mono text-xs text-gray-400">{feature.key}</p>
              </div>
              <button
                onClick={() => toggle(feature, entitlement)}
                disabled={!tenantId}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  entitlement?.enabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {entitlement?.enabled ? 'Enabled' : entitlement ? 'Disabled' : 'Grant'}
              </button>
              {entitlement && (
                <button onClick={() => setConfirmRevoke(feature)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {features.length === 0 && <p className="text-sm text-gray-400">No feature catalog entries.</p>}
      </div>
      {confirmRevoke && (
        <ConfirmDialog
          title="Revoke feature entitlement"
          message={`Remove ${confirmRevoke.name} from this tenant?`}
          confirmLabel="Revoke"
          variant="warning"
          onConfirm={() => revoke(confirmRevoke)}
          onCancel={() => setConfirmRevoke(null)}
        />
      )}
    </Section>
  );
}

function ModelEntitlements({
  tenantId,
  models,
  entitlements,
  onRefresh,
  onToast,
}: {
  tenantId: string | null;
  models: ModelConfig[];
  entitlements: ModelEntitlement[];
  onRefresh: () => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [selectedModelId, setSelectedModelId] = useState('');
  const [rpmLimit, setRpmLimit] = useState('');
  const [tpmLimit, setTpmLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  const modelsByOpType = useMemo(() => {
    const groups: Record<string, ModelConfig[]> = {};
    for (const m of models) {
      if (!m.is_active) continue;
      (groups[m.operation_type] ??= []).push(m);
    }
    return groups;
  }, [models]);

  async function grant(e: FormEvent) {
    e.preventDefault();
    if (!tenantId || !selectedModel) return;
    setSaving(true);
    try {
      await iamApi.grantPlatformModelEntitlement(tenantId, {
        modelKey: selectedModel.model_key,
        operationType: selectedModel.operation_type,
        allowed: true,
        rpmLimit: rpmLimit ? Number(rpmLimit) : undefined,
        tpmLimit: tpmLimit ? Number(tpmLimit) : undefined,
        config: '{}',
      });
      setSelectedModelId('');
      setRpmLimit('');
      setTpmLimit('');
      onToast('success', 'Model entitlement granted.');
      onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to grant model entitlement.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(entitlement: ModelEntitlement) {
    if (!tenantId) return;
    try {
      await iamApi.updatePlatformModelEntitlement(tenantId, entitlement.id, {
        allowed: !entitlement.allowed,
      });
      onToast('success', 'Model entitlement updated.');
      onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to update model entitlement.');
    }
  }

  async function confirmRevoke(entitlement: ModelEntitlement) {
    if (!tenantId) return;
    setRevoking(true);
    try {
      await iamApi.revokePlatformModelEntitlement(tenantId, entitlement.id);
      onToast('success', 'Model entitlement removed.');
      onRefresh();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to remove model entitlement.');
    } finally {
      setRevoking(false);
      setPendingDeleteId(null);
    }
  }

  return (
    <Section title="Model entitlements" description="Grant AI model access and rate limits for the selected tenant.">
      <form onSubmit={grant} className="mb-4 grid gap-3 md:grid-cols-[2fr_auto_1fr_1fr_auto]">
        <select
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          required
        >
          <option value="">Select a model…</option>
          {Object.entries(modelsByOpType).map(([opType, opModels]) => (
            <optgroup key={opType} label={opType.toUpperCase()}>
              {opModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name} — {m.model_key}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium ${
          selectedModel?.operation_type === 'chat'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : selectedModel?.operation_type === 'embed'
            ? 'border-purple-200 bg-purple-50 text-purple-700'
            : selectedModel?.operation_type === 'rerank'
            ? 'border-orange-200 bg-orange-50 text-orange-700'
            : 'border-gray-200 bg-gray-50 text-gray-400'
        }`}>
          {selectedModel?.operation_type ?? 'type'}
        </span>
        <input value={rpmLimit} onChange={(e) => setRpmLimit(e.target.value.replace(/\D/g, ''))} placeholder="RPM" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
        <input value={tpmLimit} onChange={(e) => setTpmLimit(e.target.value.replace(/\D/g, ''))} placeholder="TPM" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
        <button disabled={!tenantId || saving || !selectedModel} className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Grant
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Operation</th>
              <th className="px-4 py-3 text-left">Limits</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entitlements.map((entitlement) => (
              <tr key={entitlement.id} className={pendingDeleteId === entitlement.id ? 'bg-red-50' : ''}>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{entitlement.modelKey}</td>
                <td className="px-4 py-3 text-gray-600">{entitlement.operationType}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  RPM {entitlement.rpmLimit ?? '∞'} · TPM {entitlement.tpmLimit ?? '∞'}
                </td>
                <td className="px-4 py-3 text-right">
                  {pendingDeleteId === entitlement.id ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">Remove?</span>
                      <button
                        onClick={() => confirmRevoke(entitlement)}
                        disabled={revoking}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        disabled={revoking}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => toggle(entitlement)}
                        className={`mr-2 rounded-lg px-3 py-1.5 text-xs font-medium ${entitlement.allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {entitlement.allowed ? 'Allowed' : 'Blocked'}
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(entitlement.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {entitlements.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No model entitlements.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export default function PlatformPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [featureEntitlements, setFeatureEntitlements] = useState<FeatureEntitlement[]>([]);
  const [modelEntitlements, setModelEntitlements] = useState<ModelEntitlement[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadBase() {
    setLoading(true);
    try {
      const [tenantsResult, featuresResult, modelsResult] = await Promise.allSettled([
        iamApi.listPlatformTenants(),
        iamApi.listFeatures(),
        modelsApi.list(),
      ]);

      const tenantList = tenantsResult.status === 'fulfilled' ? tenantsResult.value : [];
      setTenants(tenantList);
      setSelectedTenantId((current) => current || tenantList[0]?.id || '');

      if (featuresResult.status === 'fulfilled') setFeatures(featuresResult.value);
      if (modelsResult.status === 'fulfilled') setModels(modelsResult.value);

      if (tenantsResult.status === 'rejected') {
        showToast('error', tenantsResult.reason instanceof Error ? tenantsResult.reason.message : 'Failed to load tenants.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadTenant(tenantId = selectedTenantId) {
    if (!tenantId) return;
    setTenantLoading(true);
    try {
      const [workspaceList, featureRows, modelRows] = await Promise.all([
        iamApi.listPlatformTenantWorkspaces(tenantId),
        iamApi.listPlatformFeatureEntitlements(tenantId),
        iamApi.listPlatformModelEntitlements(tenantId),
      ]);
      setWorkspaces(workspaceList);
      setFeatureEntitlements(featureRows);
      setModelEntitlements(modelRows);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load tenant entitlements.');
    } finally {
      setTenantLoading(false);
    }
  }

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadTenant(selectedTenantId); }, [selectedTenantId]);

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <Shield className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Platform Admin</h2>
            <p className="text-sm text-gray-500">Manage tenants, feature access, and model entitlements.</p>
          </div>
        </div>
        <select
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="min-w-64 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
        >
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.code})</option>
          ))}
        </select>
      </div>

      <div className="space-y-5">
        <TenantPanel tenant={selectedTenant} workspaces={workspaces} />
        <FeatureCatalog features={features} onRefresh={loadBase} onToast={showToast} />
        {tenantLoading ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <FeatureEntitlements
              tenantId={selectedTenantId}
              features={features}
              entitlements={featureEntitlements}
              onRefresh={() => loadTenant()}
              onToast={showToast}
            />
            <ModelEntitlements
              tenantId={selectedTenantId}
              models={models}
              entitlements={modelEntitlements}
              onRefresh={() => loadTenant()}
              onToast={showToast}
            />
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Building2 className="mb-2 h-4 w-4 text-gray-400" />
          <p className="text-2xl font-semibold text-gray-900">{tenants.length}</p>
          <p className="text-xs text-gray-400">active tenants</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Key className="mb-2 h-4 w-4 text-gray-400" />
          <p className="text-2xl font-semibold text-gray-900">{featureEntitlements.filter((item) => item.enabled).length}</p>
          <p className="text-xs text-gray-400">enabled features</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Database className="mb-2 h-4 w-4 text-gray-400" />
          <p className="text-2xl font-semibold text-gray-900">{modelEntitlements.filter((item) => item.allowed).length}</p>
          <p className="text-xs text-gray-400">allowed models</p>
        </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
