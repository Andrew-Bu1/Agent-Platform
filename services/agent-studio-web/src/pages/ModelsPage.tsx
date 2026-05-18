import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, AlertCircle, ChevronDown } from 'lucide-react';
import { providersApi, modelsApi } from '../api/aihub';
import type {
  Provider,
  ModelConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
  CreateModelConfigRequest,
  ModelOperationType,
} from '../types/api';

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';
const SELECT = INPUT + ' bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const OP_COLORS: Record<string, string> = {
  chat:   'bg-blue-100 text-blue-700',
  embed:  'bg-purple-100 text-purple-700',
  rerank: 'bg-orange-100 text-orange-700',
};

// ─── Provider modal ───────────────────────────────────────────────────────────

function ProviderModal({
  provider,
  onClose,
  onSaved,
}: {
  provider: Provider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!provider;
  const [form, setForm] = useState({
    provider_key:  provider?.provider_key  ?? '',
    display_name:  provider?.display_name  ?? '',
    description:   provider?.description   ?? '',
    logo_url:      provider?.logo_url      ?? '',
    base_url:      provider?.base_url      ?? '',
    adapter_type:  provider?.adapter_type  ?? 'openai',
    sort_order:    String(provider?.sort_order ?? 0),
    api_key:       '',
    is_active:     provider?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isEdit) {
        const body: UpdateProviderRequest = {
          display_name: form.display_name  || undefined,
          description:  form.description   || undefined,
          logo_url:     form.logo_url      || undefined,
          base_url:     form.base_url      || undefined,
          adapter_type: form.adapter_type  || undefined,
          is_active:    form.is_active,
          sort_order:   Number(form.sort_order),
          api_key:      form.api_key       || undefined,
        };
        await providersApi.update(provider!.id, body);
      } else {
        const body: CreateProviderRequest = {
          provider_key: form.provider_key,
          display_name: form.display_name,
          description:  form.description   || undefined,
          logo_url:     form.logo_url      || undefined,
          base_url:     form.base_url      || undefined,
          adapter_type: form.adapter_type  || undefined,
          sort_order:   Number(form.sort_order),
          api_key:      form.api_key       || undefined,
        };
        await providersApi.create(body);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save provider.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={isEdit ? 'Edit provider' : 'New provider'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {!isEdit && (
          <Field label="Provider key *">
            <input
              required
              value={form.provider_key}
              onChange={set('provider_key')}
              placeholder="openai"
              className={INPUT}
              autoFocus
            />
          </Field>
        )}

        <Field label="Display name *">
          <input
            required
            value={form.display_name}
            onChange={set('display_name')}
            placeholder="OpenAI"
            className={INPUT}
            autoFocus={isEdit}
          />
        </Field>

        <Field label="Adapter type *">
          <select value={form.adapter_type} onChange={set('adapter_type')} className={SELECT}>
            {['openai', 'anthropic', 'google', 'cohere', 'ollama', 'custom'].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Base URL">
            <input
              value={form.base_url}
              onChange={set('base_url')}
              placeholder="https://api.openai.com/v1"
              className={INPUT}
            />
          </Field>
          <Field label="Sort order">
            <input type="number" value={form.sort_order} onChange={set('sort_order')} className={INPUT} />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={2}
            className={INPUT + ' resize-none'}
            placeholder="Optional description"
          />
        </Field>

        <Field label={isEdit ? 'API key (leave blank to keep current)' : 'API key'}>
          <input
            type="password"
            value={form.api_key}
            onChange={set('api_key')}
            placeholder="sk-…"
            className={INPUT}
          />
        </Field>

        {isEdit && (
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        )}

        {error && <ErrorMsg message={error} />}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !form.display_name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create provider'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Model modal ──────────────────────────────────────────────────────────────

function ModelModal({
  model,
  providers,
  onClose,
  onSaved,
}: {
  model: ModelConfig | null;
  providers: Provider[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!model;
  const [form, setForm] = useState({
    provider_key:          model?.provider_key       ?? (providers[0]?.provider_key ?? ''),
    model_key:             model?.model_key          ?? '',
    display_name:          model?.display_name       ?? '',
    description:           model?.description        ?? '',
    provider_model_id:     model?.provider_model_id  ?? '',
    operation_type:        (model?.operation_type    ?? 'chat') as ModelOperationType,
    input_cost:            model?.input_cost         ?? '',
    output_cost:           model?.output_cost        ?? '',
    context_window_tokens: String(model?.context_window_tokens ?? ''),
    max_output_tokens:     String(model?.max_output_tokens     ?? ''),
    embedding_dimensions:  String(model?.embedding_dimensions  ?? ''),
    supports_streaming:    model?.supports_streaming ?? true,
    supports_tools:        model?.supports_tools     ?? false,
    supports_json_mode:    model?.supports_json_mode ?? false,
    supports_vision:       model?.supports_vision    ?? false,
    is_active:             model?.is_active          ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const setB =
    (k: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.checked }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isEdit) {
        await modelsApi.update(model!.id, {
          display_name:          form.display_name          || undefined,
          description:           form.description           || undefined,
          input_cost:            form.input_cost            || undefined,
          output_cost:           form.output_cost           || undefined,
          context_window_tokens: form.context_window_tokens ? Number(form.context_window_tokens) : undefined,
          max_output_tokens:     form.max_output_tokens     ? Number(form.max_output_tokens)     : undefined,
          supports_streaming:    form.supports_streaming,
          supports_tools:        form.supports_tools,
          supports_json_mode:    form.supports_json_mode,
          supports_vision:       form.supports_vision,
          is_active:             form.is_active,
        });
      } else {
        const body: CreateModelConfigRequest = {
          provider_key:          form.provider_key,
          model_key:             form.model_key,
          display_name:          form.display_name,
          description:           form.description           || undefined,
          provider_model_id:     form.provider_model_id,
          operation_type:        form.operation_type,
          input_cost:            form.input_cost            || undefined,
          output_cost:           form.output_cost           || undefined,
          context_window_tokens: form.context_window_tokens ? Number(form.context_window_tokens) : undefined,
          max_output_tokens:     form.max_output_tokens     ? Number(form.max_output_tokens)     : undefined,
          embedding_dimensions:  form.embedding_dimensions  ? Number(form.embedding_dimensions)  : undefined,
          supports_streaming:    form.supports_streaming,
          supports_tools:        form.supports_tools,
          supports_json_mode:    form.supports_json_mode,
          supports_vision:       form.supports_vision,
        };
        await modelsApi.create(body);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save model.');
    } finally {
      setLoading(false);
    }
  }

  type CapabilityKey =
    | 'supports_streaming'
    | 'supports_tools'
    | 'supports_json_mode'
    | 'supports_vision'
    | 'is_active';

  const CAPS: Array<{ key: CapabilityKey; label: string }> = [
    { key: 'supports_streaming', label: 'Streaming'    },
    { key: 'supports_tools',     label: 'Tool calling' },
    { key: 'supports_json_mode', label: 'JSON mode'    },
    { key: 'supports_vision',    label: 'Vision'       },
    ...(isEdit ? [{ key: 'is_active' as const, label: 'Active' }] : []),
  ];

  return (
    <ModalShell title={isEdit ? 'Edit model' : 'New model'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {!isEdit && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Provider *">
                <select value={form.provider_key} onChange={set('provider_key')} className={SELECT}>
                  {providers.map((p) => (
                    <option key={p.provider_key} value={p.provider_key}>{p.display_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Operation type *">
                <select value={form.operation_type} onChange={set('operation_type')} className={SELECT}>
                  {(['chat', 'embed', 'rerank'] as const).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Model key *">
                <input
                  required
                  value={form.model_key}
                  onChange={set('model_key')}
                  placeholder="gpt-4o"
                  className={INPUT}
                  autoFocus
                />
              </Field>
              <Field label="Provider model ID *">
                <input
                  required
                  value={form.provider_model_id}
                  onChange={set('provider_model_id')}
                  placeholder="gpt-4o"
                  className={INPUT}
                />
              </Field>
            </div>
          </>
        )}

        <Field label="Display name *">
          <input
            required
            value={form.display_name}
            onChange={set('display_name')}
            placeholder="GPT-4o"
            className={INPUT}
            autoFocus={isEdit}
          />
        </Field>

        <Field label="Description">
          <input
            value={form.description}
            onChange={set('description')}
            placeholder="Optional description"
            className={INPUT}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Input cost / 1M tokens">
            <input value={form.input_cost}  onChange={set('input_cost')}  placeholder="2.50"  className={INPUT} />
          </Field>
          <Field label="Output cost / 1M tokens">
            <input value={form.output_cost} onChange={set('output_cost')} placeholder="10.00" className={INPUT} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Context window (tokens)">
            <input
              type="number"
              value={form.context_window_tokens}
              onChange={set('context_window_tokens')}
              placeholder="128000"
              className={INPUT}
            />
          </Field>
          <Field label="Max output (tokens)">
            <input
              type="number"
              value={form.max_output_tokens}
              onChange={set('max_output_tokens')}
              placeholder="16384"
              className={INPUT}
            />
          </Field>
        </div>

        {!isEdit && form.operation_type === 'embed' && (
          <Field label="Embedding dimensions">
            <input
              type="number"
              value={form.embedding_dimensions}
              onChange={set('embedding_dimensions')}
              placeholder="1536"
              className={INPUT}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 pt-1">
          {CAPS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={setB(key)}
                className="w-4 h-4 rounded accent-brand-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        {error && <ErrorMsg message={error} />}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !form.display_name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add model'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'providers' | 'models';

export default function ModelsPage() {
  const [tab, setTab] = useState<Tab>('providers');

  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels]       = useState<ModelConfig[]>([]);
  const [opFilter, setOpFilter]   = useState<ModelOperationType | ''>('');

  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingModels, setLoadingModels]       = useState(true);

  const [providerModal, setProviderModal] = useState<Provider | null | 'new'>(null);
  const [modelModal, setModelModal]       = useState<ModelConfig | null | 'new'>(null);
  const [deleting, setDeleting]           = useState<string | null>(null);

  async function loadProviders() {
    setLoadingProviders(true);
    try { setProviders(await providersApi.list()); } catch { /* ignore */ } finally { setLoadingProviders(false); }
  }

  async function loadModels() {
    setLoadingModels(true);
    try {
      setModels(
        await modelsApi.list(opFilter ? { operation_type: opFilter as ModelOperationType } : undefined),
      );
    } catch { /* ignore */ } finally { setLoadingModels(false); }
  }

  useEffect(() => { loadProviders(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadModels(); }, [opFilter]);

  async function deleteProvider(id: string) {
    if (!confirm('Delete this provider? All associated models will need to be removed first.')) return;
    setDeleting(id);
    try { await providersApi.delete(id); await loadProviders(); } catch { /* ignore */ } finally { setDeleting(null); }
  }

  async function deleteModel(id: string) {
    if (!confirm('Delete this model?')) return;
    setDeleting(id);
    try { await modelsApi.delete(id); await loadModels(); } catch { /* ignore */ } finally { setDeleting(null); }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Models</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage AI providers and model configurations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['providers', 'models'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Providers tab ── */}
      {tab === 'providers' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">
              {providers.length} provider{providers.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setProviderModal('new')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add provider
            </button>
          </div>

          {loadingProviders ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              No providers yet. Add one to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Provider</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Adapter</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">API key</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{p.display_name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{p.provider_key}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-sm">{p.adapter_type}</td>
                    <td className="px-5 py-3.5">
                      {p.has_api_key
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Configured</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Not set</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {p.is_active
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Active</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setProviderModal(p)}
                          className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteProvider(p.id)}
                          disabled={deleting === p.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          {deleting === p.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Models tab ── */}
      {tab === 'models' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 gap-3">
            {/* Filter */}
            <div className="relative">
              <select
                value={opFilter}
                onChange={(e) => setOpFilter(e.target.value as ModelOperationType | '')}
                className="pl-3 pr-8 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-brand-400 bg-white appearance-none"
              >
                <option value="">All types</option>
                <option value="chat">Chat</option>
                <option value="embed">Embed</option>
                <option value="rerank">Rerank</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => setModelModal('new')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add model
            </button>
          </div>

          {loadingModels ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">No models configured yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Model</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Provider</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Context</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {models.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{m.display_name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{m.model_key}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">{m.provider_key}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OP_COLORS[m.operation_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {m.operation_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {m.context_window_tokens ? `${(m.context_window_tokens / 1000).toFixed(0)}k` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {m.is_active
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Active</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModelModal(m)}
                          className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteModel(m.id)}
                          disabled={deleting === m.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          {deleting === m.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {providerModal !== null && (
        <ProviderModal
          provider={providerModal === 'new' ? null : providerModal}
          onClose={() => setProviderModal(null)}
          onSaved={loadProviders}
        />
      )}
      {modelModal !== null && (
        <ModelModal
          model={modelModal === 'new' ? null : modelModal}
          providers={providers}
          onClose={() => setModelModal(null)}
          onSaved={loadModels}
        />
      )}
    </div>
  );
}
