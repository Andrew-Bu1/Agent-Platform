import { useState, useEffect, type FormEvent } from 'react';
import {
  Bot, Plus, Pencil, Trash2, Loader2, X, AlertCircle, Key,
  Brain, Zap, Search, Check,
} from 'lucide-react';
import { agentsApi } from '../api/agents';
import { modelsApi } from '../api/aihub';
import { toolsApi } from '../api/tools';
import type { Agent, CreateAgentRequest, ModelConfig, Tool } from '../types/api';
import type { MemoryStrategy } from '../types/canvas';

const KIND_PERMISSIONS: Record<string, string[]> = {
  react: ['model:invoke'],
  team:  ['model:invoke', 'agent:run'],
};

const AGENT_KINDS = ['react', 'team'] as const;
type AgentKind = typeof AGENT_KINDS[number];

const KIND_LABELS: Record<AgentKind, string> = {
  react: 'React Agent',
  team:  'Team',
};

const KIND_DESCRIPTIONS: Record<AgentKind, string> = {
  react: 'Single agent — ReAct loop with tools',
  team:  'Supervisor + member agents (handoff)',
};

const KIND_ICONS: Record<AgentKind, React.ReactNode> = {
  react: <Zap className="w-4 h-4" />,
  team:  <Brain className="w-4 h-4" />,
};

const KIND_COLORS: Record<string, string> = {
  react: 'bg-purple-100 text-purple-700',
  team:  'bg-blue-100 text-blue-700',
};

const KIND_USES_TOOLS: Record<AgentKind, boolean> = {
  react: true,
  team:  false,
};

// ─── Tool multi-select ────────────────────────────────────────────────────────

const TOOL_TYPE_COLORS: Record<string, string> = {
  http_api: 'bg-sky-100 text-sky-700',
  function: 'bg-amber-100 text-amber-700',
  code:     'bg-violet-100 text-violet-700',
  database: 'bg-emerald-100 text-emerald-700',
  custom:   'bg-gray-100 text-gray-700',
};

function ToolSelector({
  tools,
  selected,
  onChange,
}: { tools: Tool[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const filtered = tools.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()) ||
           (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border-b border-gray-200 outline-none focus:bg-gray-50"
        />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">No tools found</p>
        ) : (
          filtered.map((t) => {
            const active = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  active ? 'bg-brand-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                  active ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
                }`}>
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-gray-400 truncate">{t.description}</p>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${TOOL_TYPE_COLORS[t.toolType] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t.toolType}
                </span>
              </button>
            );
          })
        )}
      </div>
      {selected.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          {selected.length} tool{selected.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

// ─── Model selector ───────────────────────────────────────────────────────────

function ModelSelector({
  models,
  value,
  onChange,
}: { models: ModelConfig[]; value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const filtered = models.filter(
    (m) =>
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.provider_key.toLowerCase().includes(search.toLowerCase()) ||
      m.model_key.toLowerCase().includes(search.toLowerCase())
  );
  const selected = models.find((m) => m.model_key === value);

  return (
    <div className="space-y-2">
      {selected && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 border border-brand-200 text-sm">
          <Brain className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span className="font-medium text-brand-800 flex-1 truncate">{selected.display_name}</span>
          <span className="text-xs text-brand-500 font-mono">{selected.provider_key}</span>
          <button type="button" onClick={() => onChange('')} className="text-brand-400 hover:text-brand-700 ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border-b border-gray-200 outline-none focus:bg-gray-50"
          />
        </div>
        <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-5">No models found</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange(m.model_key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  value === m.model_key ? 'bg-brand-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                  value === m.model_key ? 'border-brand-600 bg-brand-600' : 'border-gray-300'
                }`}>
                  {value === m.model_key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.display_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{m.provider_key} · {m.model_key}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {m.supports_tools && (
                    <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-medium rounded border border-orange-200">tools</span>
                  )}
                  {m.supports_streaming && (
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-medium rounded border border-green-200">stream</span>
                  )}
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">{m.operation_type}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function AgentModal({
  agent,
  onClose,
  onSaved,
}: {
  agent: Agent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!agent;

  // Basic fields
  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [agentKind, setAgentKind] = useState<AgentKind>((agent?.agentKind as AgentKind) ?? 'react');
  const [modelKey, setModelKey] = useState(agent?.modelId ?? '');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(agent?.toolIds ?? []);

  // Definition fields (extracted from agent.definition)
  const def = agent?.definition ?? {};
  const [systemPrompt, setSystemPrompt] = useState((def.system_prompt as string) ?? '');
  const [maxIterations, setMaxIterations] = useState(String((def.max_iterations as number) ?? 10));
  const defMem = (def.memory as { memory_strategy?: string; memory_last_n?: number; memory_summarize_threshold?: number; memory_summarize_model?: string }) ?? {};
  const [memoryStrategy, setMemoryStrategy] = useState<MemoryStrategy>(
    (defMem.memory_strategy as MemoryStrategy) ?? 'last_n',
  );
  const [memoryLastN, setMemoryLastN] = useState(String(defMem.memory_last_n ?? 20));
  const [memorySummarizeThreshold, setMemorySummarizeThreshold] = useState(String(defMem.memory_summarize_threshold ?? 40));
  const [memorySummarizeModel, setMemorySummarizeModel] = useState(defMem.memory_summarize_model ?? '');

  // Remote data
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      try {
        const [modelsRes, toolsRes] = await Promise.all([
          modelsApi.list({ operation_type: 'chat' }),
          toolsApi.list(0, 100),
        ]);
        setModels(modelsRes);
        setTools(toolsRes.content);
      } catch {
        // non-fatal — forms still usable
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  function buildDefinition(): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    if (agentKind === 'react') {
      if (systemPrompt.trim()) d.system_prompt = systemPrompt.trim();
      const n = parseInt(maxIterations, 10);
      if (!isNaN(n)) d.max_iterations = n;
      const mem: Record<string, unknown> = { memory_strategy: memoryStrategy };
      if (memoryStrategy === 'last_n') {
        const lastN = parseInt(memoryLastN, 10);
        mem.memory_last_n = isNaN(lastN) ? 20 : lastN;
      } else if (memoryStrategy === 'summarize') {
        const t = parseInt(memorySummarizeThreshold, 10);
        mem.memory_summarize_threshold = isNaN(t) ? 40 : t;
        if (memorySummarizeModel.trim()) mem.memory_summarize_model = memorySummarizeModel.trim();
      }
      d.memory = mem;
    }
    return d;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const definition = buildDefinition();
    setSaving(true);
    try {
      const body: CreateAgentRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        agentKind,
        modelId: modelKey || undefined,
        toolIds: selectedToolIds,
        definition,
      };
      if (isEdit) {
        await agentsApi.update(agent.id, body);
      } else {
        await agentsApi.create(body);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save agent.');
    } finally {
      setSaving(false);
    }
  }

  const permissions = KIND_PERMISSIONS[agentKind] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit agent' : 'New agent'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Name + description */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My research agent"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this agent does…"
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              />
            </div>
          </div>

          {/* Agent kind */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Agent kind *</label>
            <div className="grid grid-cols-5 gap-2">
              {AGENT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAgentKind(k)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-center transition-all ${
                    agentKind === k
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-700'
                  }`}
                >
                  {KIND_ICONS[k]}
                  <span className="text-xs font-medium leading-tight">{KIND_LABELS[k]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{KIND_DESCRIPTIONS[agentKind]}</p>
          </div>

          <div className="border-t border-gray-100" />

          {/* Model selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model
              <span className="ml-1.5 text-gray-400 font-normal">(chat models)</span>
            </label>
            {loadingData ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading models…
              </div>
            ) : (
              <ModelSelector models={models} value={modelKey} onChange={setModelKey} />
            )}
          </div>

          {/* Tools — only for kinds that support them */}
          {KIND_USES_TOOLS[agentKind] && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tools</label>
              {loadingData ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading tools…
                </div>
              ) : (
                <ToolSelector tools={tools} selected={selectedToolIds} onChange={setSelectedToolIds} />
              )}
            </div>
          )}

          <div className="border-t border-gray-100" />

          {/* Definition — kind-aware */}
          {agentKind === 'react' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">System prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant…"
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Max iterations</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(e.target.value)}
                  className="w-32 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Memory</label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Strategy</label>
                    <div className="flex gap-2">
                      {(['last_n', 'summarize', 'none'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setMemoryStrategy(s)}
                          className={`flex-1 py-2 text-sm rounded-xl border font-medium transition-colors ${
                            memoryStrategy === s
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-700'
                          }`}
                        >
                          {s === 'last_n' ? 'Last N' : s === 'summarize' ? 'Summarize' : 'None'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {memoryStrategy === 'none'
                        ? 'Agent receives no conversation history — fresh context every run.'
                        : memoryStrategy === 'summarize'
                        ? 'Keeps a rolling summary in the thread; summarizes when the unsummarized tail exceeds the threshold.'
                        : 'Load the most recent N messages from the thread before each run.'}
                    </p>
                  </div>
                  {memoryStrategy === 'last_n' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Window size (messages)</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={memoryLastN}
                        onChange={(e) => setMemoryLastN(e.target.value)}
                        className="w-32 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                      <p className="text-xs text-gray-400 mt-1">Default: 20. Higher values consume more context tokens.</p>
                    </div>
                  )}
                  {memoryStrategy === 'summarize' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Summarize threshold (messages)</label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={memorySummarizeThreshold}
                          onChange={(e) => setMemorySummarizeThreshold(e.target.value)}
                          className="w-32 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                        />
                        <p className="text-xs text-gray-400 mt-1">Summarize when unsummarized messages exceed this count. Default: 40.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Summarizer model (optional)</label>
                        <input
                          type="text"
                          value={memorySummarizeModel}
                          onChange={(e) => setMemorySummarizeModel(e.target.value)}
                          placeholder="Defaults to agent model"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                        />
                        <p className="text-xs text-gray-400 mt-1">Use a cheaper/faster model for summarization (e.g. gpt-4o-mini).</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {agentKind === 'team' && (
            <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
              <Brain className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Team agents act as a supervisor that delegates to member agents at runtime. Configure the member agents on the flow canvas when you build your flow.</p>
            </div>
          )}

          {/* Permissions badge */}
          <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
            <Key className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Required permissions (determined by kind)</p>
              <div className="flex flex-wrap gap-1.5">
                {permissions.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">None</span>
                ) : (
                  permissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-mono rounded-lg border border-brand-200">{p}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Footer */}
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
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalAgent, setModalAgent] = useState<Agent | null | 'new'>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await agentsApi.list(p, 20);
      setAgents(res.content);
      setTotal(res.totalElements);
    } catch {
      // ignore — keep old list
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this agent? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await agentsApi.delete(id);
      load();
    } catch {
      alert('Failed to delete agent.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agents</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} agent{total !== 1 ? 's' : ''} in this workspace</p>
        </div>
        <button
          onClick={() => setModalAgent('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New agent
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <Bot className="w-10 h-10" />
            <p className="text-sm">No agents yet. Create your first one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kind</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Model</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tools</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissions</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        {agent.description && (
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">{agent.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[agent.agentKind] ?? 'bg-gray-100 text-gray-700'}`}>
                      {agent.agentKind}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{agent.modelId ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{agent.toolIds.length} tool{agent.toolIds.length !== 1 ? 's' : ''}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(KIND_PERMISSIONS[agent.agentKind] ?? []).slice(0, 2).map((k) => (
                        <span key={k} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 text-[10px] font-mono rounded border border-brand-200">{k}</span>
                      ))}
                      {(KIND_PERMISSIONS[agent.agentKind] ?? []).length === 0 && (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(agent.updatedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModalAgent(agent)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        disabled={deleting === agent.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === agent.id
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

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{page * 20 + 1}–{Math.min((page + 1) * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={(page + 1) * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAgent !== null && (
        <AgentModal
          agent={modalAgent === 'new' ? null : modalAgent}
          onClose={() => setModalAgent(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
