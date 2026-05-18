import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Wrench, Plus, Pencil, Trash2, Loader2, X, AlertCircle,
  Globe, Code2, Database, Zap, ChevronDown, ChevronRight,
} from 'lucide-react';
import { toolsApi } from '../api/tools';
import type { Tool, CreateToolRequest } from '../types/api';

const TOOL_TYPES = ['function', 'http_api', 'code', 'database', 'custom'] as const;
type ToolType = typeof TOOL_TYPES[number];

const TYPE_COLORS: Record<string, string> = {
  http_api:  'bg-sky-100 text-sky-700',
  function:  'bg-amber-100 text-amber-700',
  code:      'bg-violet-100 text-violet-700',
  database:  'bg-emerald-100 text-emerald-700',
  custom:    'bg-gray-100 text-gray-700',
};

const TYPE_LABELS: Record<string, string> = {
  function: 'Function',
  http_api: 'HTTP API',
  code: 'Code',
  database: 'Database',
  custom: 'Custom',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  function: <Zap className="w-4 h-4" />,
  http_api: <Globe className="w-4 h-4" />,
  code: <Code2 className="w-4 h-4" />,
  database: <Database className="w-4 h-4" />,
  custom: <Wrench className="w-4 h-4" />,
};

// ─── Parameter types ──────────────────────────────────────────────────────────

interface FnParam {
  id: string;
  name: string;
  type: string;
  description: string;
  required: boolean;
  enumValues: string; // comma-separated for string type
}

interface HttpHeader {
  id: string;
  key: string;
  value: string;
}

const PARAM_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const AUTH_TYPES = ['none', 'bearer', 'api_key', 'basic'];
const CODE_RUNTIMES = ['python', 'javascript', 'typescript'];

function uid() { return Math.random().toString(36).slice(2); }

function newParam(): FnParam {
  return { id: uid(), name: '', type: 'string', description: '', required: false, enumValues: '' };
}
function newHeader(): HttpHeader {
  return { id: uid(), key: '', value: '' };
}

// ─── Schema helpers ───────────────────────────────────────────────────────────

function paramsToSchema(params: FnParam[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    const key = p.name.trim();
    if (!key) continue;
    const def: Record<string, unknown> = { type: p.type };
    if (p.description.trim()) def.description = p.description.trim();
    if (p.type === 'string' && p.enumValues.trim()) {
      def.enum = p.enumValues.split(',').map((s) => s.trim()).filter(Boolean);
    }
    properties[key] = def;
    if (p.required) required.push(key);
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

function schemaToParams(schema: Record<string, unknown> | null | undefined): FnParam[] {
  if (!schema || typeof schema !== 'object') return [];
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return [];
  const req = (schema.required as string[]) ?? [];
  return Object.entries(props).map(([name, def]) => ({
    id: uid(),
    name,
    type: (def.type as string) ?? 'string',
    description: (def.description as string) ?? '',
    required: req.includes(name),
    enumValues: Array.isArray(def.enum) ? (def.enum as string[]).join(', ') : '',
  }));
}

function buildFunctionConfig(params: FnParam[]): Record<string, unknown> {
  return { parameters: paramsToSchema(params) };
}

function buildHttpConfig(opts: {
  url: string; method: string; headers: HttpHeader[];
  authType: string; authValue: string; authKeyName: string; bodyTemplate: string;
}): Record<string, unknown> {
  const cfg: Record<string, unknown> = { url: opts.url, method: opts.method };
  const hdrs: Record<string, string> = {};
  for (const h of opts.headers) {
    if (h.key.trim()) hdrs[h.key.trim()] = h.value;
  }
  if (Object.keys(hdrs).length) cfg.headers = hdrs;
  if (opts.authType !== 'none') {
    cfg.auth = opts.authType === 'api_key'
      ? { type: opts.authType, keyName: opts.authKeyName, value: opts.authValue }
      : { type: opts.authType, value: opts.authValue };
  }
  if (opts.bodyTemplate.trim()) {
    try { cfg.bodyTemplate = JSON.parse(opts.bodyTemplate); }
    catch { cfg.bodyTemplate = opts.bodyTemplate; }
  }
  return cfg;
}

function buildCodeConfig(opts: { runtime: string; code: string }): Record<string, unknown> {
  return { runtime: opts.runtime, code: opts.code };
}

function buildDatabaseConfig(opts: { connectionString: string; query: string }): Record<string, unknown> {
  return { connectionString: opts.connectionString, query: opts.query };
}

// ─── JSON Preview panel ───────────────────────────────────────────────────────

function JsonPreview({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium">JSON Preview</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <pre className="px-4 py-3 text-xs font-mono bg-gray-950 text-green-400 overflow-auto max-h-48">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Function config builder ──────────────────────────────────────────────────

function FunctionConfigForm({
  params, setParams,
}: { params: FnParam[]; setParams: (p: FnParam[]) => void }) {
  const update = (id: string, field: keyof FnParam, value: string | boolean) =>
    setParams(params.map((p) => p.id === id ? { ...p, [field]: value } : p));
  const remove = (id: string) => setParams(params.filter((p) => p.id !== id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700">Parameters</label>
          <p className="text-xs text-gray-400 mt-0.5">OpenAI function calling format — define each input parameter</p>
        </div>
        <button
          type="button"
          onClick={() => setParams([...params, newParam()])}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add parameter
        </button>
      </div>

      {params.length === 0 ? (
        <div className="text-center py-6 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
          No parameters yet — click "Add parameter" to define inputs
        </div>
      ) : (
        <div className="space-y-2">
          {params.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 w-5 shrink-0">#{i + 1}</span>
                <input
                  value={p.name}
                  onChange={(e) => update(p.id, 'name', e.target.value)}
                  placeholder="parameter_name"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
                />
                <select
                  value={p.type}
                  onChange={(e) => update(p.id, 'type', e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
                >
                  {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={p.required}
                    onChange={(e) => update(p.id, 'required', e.target.checked)}
                    className="w-3.5 h-3.5 accent-brand-600"
                  />
                  required
                </label>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={p.description}
                onChange={(e) => update(p.id, 'description', e.target.value)}
                placeholder="Describe what this parameter does…"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
              />
              {p.type === 'string' && (
                <input
                  value={p.enumValues}
                  onChange={(e) => update(p.id, 'enumValues', e.target.value)}
                  placeholder="Allowed values (comma-separated): e.g. celsius, fahrenheit"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white text-gray-500"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HTTP config builder ──────────────────────────────────────────────────────

function HttpConfigForm({ state, setState }: {
  state: {
    url: string; method: string; headers: HttpHeader[];
    authType: string; authValue: string; authKeyName: string; bodyTemplate: string;
  };
  setState: (s: typeof state) => void;
}) {
  const set = (k: string, v: string) => setState({ ...state, [k]: v });
  const updateHeader = (id: string, field: 'key' | 'value', val: string) =>
    setState({ ...state, headers: state.headers.map((h) => h.id === id ? { ...h, [field]: val } : h) });
  const removeHeader = (id: string) =>
    setState({ ...state, headers: state.headers.filter((h) => h.id !== id) });
  const addHeader = () => setState({ ...state, headers: [...state.headers, newHeader()] });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select
          value={state.method}
          onChange={(e) => set('method', e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
        >
          {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          value={state.url}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {/* Headers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Headers</label>
          <button type="button" onClick={addHeader}
            className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-medium">
            <Plus className="w-3.5 h-3.5" /> Add header
          </button>
        </div>
        <div className="space-y-1.5">
          {state.headers.map((h) => (
            <div key={h.id} className="flex gap-2 items-center">
              <input value={h.key} onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
                placeholder="Header-Name" className="w-[40%] px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              <input value={h.value} onChange={(e) => updateHeader(h.id, 'value', e.target.value)}
                placeholder="value" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              <button type="button" onClick={() => removeHeader(h.id)} className="p-1 text-gray-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {state.headers.length === 0 && (
            <p className="text-xs text-gray-400 py-1">No custom headers</p>
          )}
        </div>
      </div>

      {/* Auth */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Authentication</label>
        <div className="flex gap-2">
          <select value={state.authType} onChange={(e) => set('authType', e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white">
            {AUTH_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {state.authType !== 'none' && (
            <>
              {state.authType === 'api_key' && (
                <input value={state.authKeyName} onChange={(e) => set('authKeyName', e.target.value)}
                  placeholder="Header name (e.g. X-API-Key)"
                  className="w-[38%] px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              )}
              <input value={state.authValue} onChange={(e) => set('authValue', e.target.value)}
                placeholder={state.authType === 'basic' ? 'user:password' : 'token / key value'}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            </>
          )}
        </div>
      </div>

      {/* Body template */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Body template <span className="text-gray-400 font-normal">(optional JSON)</span></label>
        <textarea value={state.bodyTemplate} onChange={(e) => set('bodyTemplate', e.target.value)}
          placeholder={'{\n  "key": "{{param_name}}"\n}'}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none font-mono" />
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ToolModal({
  tool,
  onClose,
  onSaved,
}: {
  tool: Tool | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!tool;
  const existingCfg = tool?.config ?? {};

  // Common fields
  const [name, setName] = useState(tool?.name ?? '');
  const [description, setDescription] = useState(tool?.description ?? '');
  const [toolType, setToolType] = useState<ToolType>((tool?.toolType as ToolType) ?? 'function');

  // Function type state
  const [fnParams, setFnParams] = useState<FnParam[]>(() =>
    schemaToParams((existingCfg as Record<string, unknown>)?.parameters as Record<string, unknown>)
  );

  // HTTP type state
  const [httpState, setHttpState] = useState(() => {
    const c = existingCfg as Record<string, unknown>;
    const hdrs: HttpHeader[] = Object.entries(
      (c?.headers as Record<string, string>) ?? {}
    ).map(([key, value]) => ({ id: uid(), key, value }));
    const auth = (c?.auth as Record<string, string>) ?? {};
    return {
      url: (c?.url as string) ?? '',
      method: (c?.method as string) ?? 'GET',
      headers: hdrs,
      authType: (auth?.type as string) ?? 'none',
      authValue: (auth?.value as string) ?? '',
      authKeyName: (auth?.keyName as string) ?? '',
      bodyTemplate: c?.bodyTemplate ? JSON.stringify(c.bodyTemplate, null, 2) : '',
    };
  });

  // Code type state
  const [codeRuntime, setCodeRuntime] = useState(
    (existingCfg as Record<string, unknown>)?.runtime as string ?? 'python'
  );
  const [codeSource, setCodeSource] = useState(
    (existingCfg as Record<string, unknown>)?.code as string ?? ''
  );

  // Database type state
  const [dbConn, setDbConn] = useState(
    (existingCfg as Record<string, unknown>)?.connectionString as string ?? ''
  );
  const [dbQuery, setDbQuery] = useState(
    (existingCfg as Record<string, unknown>)?.query as string ?? ''
  );

  // Custom (raw JSON) state
  const [customRaw, setCustomRaw] = useState(
    tool?.toolType === 'custom' && tool?.config
      ? JSON.stringify(tool.config, null, 2)
      : ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildConfig = useCallback((): Record<string, unknown> | null => {
    if (toolType === 'function') return buildFunctionConfig(fnParams);
    if (toolType === 'http_api') return buildHttpConfig(httpState);
    if (toolType === 'code') return buildCodeConfig({ runtime: codeRuntime, code: codeSource });
    if (toolType === 'database') return buildDatabaseConfig({ connectionString: dbConn, query: dbQuery });
    // custom
    if (!customRaw.trim()) return {};
    try { return JSON.parse(customRaw); }
    catch { return null; }
  }, [toolType, fnParams, httpState, codeRuntime, codeSource, dbConn, dbQuery, customRaw]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const config = buildConfig();
    if (config === null) {
      setError('Config must be valid JSON.');
      return;
    }
    setLoading(true);
    try {
      const body: CreateToolRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        toolType,
        config,
      };
      if (isEdit) {
        await toolsApi.update(tool.id, body);
      } else {
        await toolsApi.create(body);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save tool.');
    } finally {
      setLoading(false);
    }
  }

  const previewConfig = buildConfig() ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit tool' : 'New tool'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Common fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="get_weather"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this tool do? The LLM uses this to decide when to call it."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              />
            </div>
          </div>

          {/* Tool type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tool type *</label>
            <div className="flex gap-2 flex-wrap">
              {TOOL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setToolType(t)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                    toolType === t
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-700'
                  }`}
                >
                  {TYPE_ICONS[t]}
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Per-type config */}
          {toolType === 'function' && (
            <FunctionConfigForm params={fnParams} setParams={setFnParams} />
          )}

          {toolType === 'http_api' && (
            <HttpConfigForm state={httpState} setState={setHttpState} />
          )}

          {toolType === 'code' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Runtime</label>
                <div className="flex gap-2">
                  {CODE_RUNTIMES.map((r) => (
                    <button key={r} type="button"
                      onClick={() => setCodeRuntime(r)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                        codeRuntime === r
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                      }`}
                    >{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Code</label>
                <textarea
                  value={codeSource}
                  onChange={(e) => setCodeSource(e.target.value)}
                  placeholder={`def run(params):\n    return {"result": params}`}
                  rows={8}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-y font-mono bg-gray-950 text-green-400"
                />
              </div>
            </div>
          )}

          {toolType === 'database' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Connection string</label>
                <input
                  value={dbConn}
                  onChange={(e) => setDbConn(e.target.value)}
                  placeholder="postgresql://user:pass@host:5432/dbname"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Query template</label>
                <textarea
                  value={dbQuery}
                  onChange={(e) => setDbQuery(e.target.value)}
                  placeholder="SELECT * FROM table WHERE id = {{id}}"
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none font-mono"
                />
              </div>
            </div>
          )}

          {toolType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Config JSON</label>
              <textarea
                value={customRaw}
                onChange={(e) => setCustomRaw(e.target.value)}
                placeholder='{ "key": "value" }'
                rows={7}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none font-mono"
              />
            </div>
          )}

          {/* JSON preview (all types) */}
          {toolType !== 'custom' && <JsonPreview data={previewConfig} />}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create tool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalTool, setModalTool] = useState<Tool | null | 'new'>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await toolsApi.list(p, 20);
      setTools(res.content);
      setTotal(res.totalElements);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this tool? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await toolsApi.delete(id);
      load();
    } catch {
      alert('Failed to delete tool.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tools</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} tool{total !== 1 ? 's' : ''} in this workspace</p>
        </div>
        <button
          onClick={() => setModalTool('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New tool
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <Wrench className="w-10 h-10" />
            <p className="text-sm">No tools yet. Register your first one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kind</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tools.map((tool) => (
                <tr key={tool.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <Wrench className="w-4 h-4 text-orange-600" />
                      </div>
                      <p className="font-medium text-gray-900">{tool.name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tool.toolType] ?? 'bg-gray-100 text-gray-700'}`}>
                      {tool.toolType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs max-w-[220px] truncate">
                    {tool.description ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(tool.updatedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModalTool(tool)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tool.id)}
                        disabled={deleting === tool.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === tool.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{page * 20 + 1}–{Math.min((page + 1) * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">Previous</button>
            <button disabled={(page + 1) * 20 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">Next</button>
          </div>
        </div>
      )}

      {modalTool !== null && (
        <ToolModal
          tool={modalTool === 'new' ? null : modalTool}
          onClose={() => setModalTool(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
