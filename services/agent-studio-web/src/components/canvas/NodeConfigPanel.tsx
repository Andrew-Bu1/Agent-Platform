import { useState, useEffect } from 'react';
import { type Node } from '@xyflow/react';
import { X, Plus, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { type CanvasNodeData, type NodeKind, type MemoryStrategy } from '../../types/canvas';
import { NODE_META } from './nodes/index';
import { toolsApi } from '../../api/tools';
import type { Agent, Tool } from '../../types/api';

interface NodeConfigPanelProps {
  node: Node;
  agents: Agent[];
  onUpdate: (nodeId: string, data: Partial<CanvasNodeData>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
}

// ─── Small form helpers ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400 appearance-none bg-white pr-7"
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ─── Section tabs ─────────────────────────────────────────────────────────────

const TABS = ['Configure', 'Members', 'Settings'] as const;
type Tab = typeof TABS[number];

// ─── Config forms per kind ────────────────────────────────────────────────────

function AgentConfig({
  data,
  agents,
  onChange,
}: {
  data: CanvasNodeData;
  agents: Agent[];
  onChange: (d: Partial<CanvasNodeData>) => void;
}) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);

  useEffect(() => {
    setLoadingTools(true);
    toolsApi.list(0, 100)
      .then((page) => setTools(page.content))
      .catch(() => setTools([]))
      .finally(() => setLoadingTools(false));
  }, []);

  return (
    <div className="space-y-3">
      <Field label="Agent">
        <Select
          value={data.agentId ?? ''}
          onChange={(v) => onChange({ agentId: v })}
          options={agents.map((a) => ({ value: a.id, label: a.name }))}
        />
      </Field>
      <Field label="Model override">
        <Input
          value={data.modelId ?? ''}
          onChange={(v) => onChange({ modelId: v })}
          placeholder="gpt-4o"
        />
      </Field>
      <Field label="Tools">
        {loadingTools ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 py-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading tools…
          </div>
        ) : tools.length === 0 ? (
          <p className="text-xs text-gray-400">No tools available.</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {tools.map((t) => {
              const selected = (data.toolIds as string[] | undefined)?.includes(t.id) ?? false;
              return (
                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const prev = (data.toolIds as string[] | undefined) ?? [];
                      const next = e.target.checked
                        ? [...prev, t.id]
                        : prev.filter((id) => id !== t.id);
                      onChange({ toolIds: next });
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-700 truncate">{t.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </Field>
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-600 mb-2">Memory</p>
        <MemoryPanel data={data} onChange={onChange} />
      </div>
    </div>
  );
}

// ─── Memory config sub-panel ──────────────────────────────────────────────────

function MemoryPanel({
  data,
  onChange,
}: {
  data: CanvasNodeData;
  onChange: (d: Partial<CanvasNodeData>) => void;
}) {
  const mem = data.memory ?? { memory_strategy: 'last_n' as MemoryStrategy, memory_last_n: 20 };
  const strategy: MemoryStrategy = mem.memory_strategy ?? 'last_n';

  function setStrategy(s: MemoryStrategy) {
    onChange({ memory: { ...mem, memory_strategy: s } });
  }

  const strategyLabels: Record<MemoryStrategy, string> = {
    last_n: 'Last N',
    summarize: 'Summarize',
    none: 'None',
  };

  const strategyHelp: Record<MemoryStrategy, string> = {
    last_n: 'Load the most recent N messages from the thread.',
    summarize: 'Keep a rolling summary in the thread; summarize when the unsummarized tail exceeds the threshold.',
    none: 'Agent receives no thread history — stateless per run.',
  };

  return (
    <div className="space-y-2">
      <Field label="Memory strategy">
        <div className="flex gap-1.5">
          {(['last_n', 'summarize', 'none'] as MemoryStrategy[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                strategy === s
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              {strategyLabels[s]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">{strategyHelp[strategy]}</p>
      </Field>

      {strategy === 'last_n' && (
        <Field label="Window size (messages)">
          <Input
            value={String(mem.memory_last_n ?? 20)}
            onChange={(v) => onChange({ memory: { ...mem, memory_last_n: Math.max(1, Number(v) || 20) } })}
            placeholder="20"
          />
        </Field>
      )}

      {strategy === 'summarize' && (
        <>
          <Field label="Summarize threshold (messages)">
            <Input
              value={String(mem.memory_summarize_threshold ?? 40)}
              onChange={(v) => onChange({ memory: { ...mem, memory_summarize_threshold: Math.max(1, Number(v) || 40) } })}
              placeholder="40"
            />
          </Field>
          <Field label="Summarizer model (optional)">
            <Input
              value={mem.memory_summarize_model ?? ''}
              onChange={(v) => onChange({ memory: { ...mem, memory_summarize_model: v || undefined } })}
              placeholder="Defaults to agent model"
            />
          </Field>
        </>
      )}
    </div>
  );
}

// agent_team nodes open AgentTeamDrawer instead — no inline config needed here

function IfElseConfig({
  data,
  onChange,
}: {
  data: CanvasNodeData;
  onChange: (d: Partial<CanvasNodeData>) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Expression">
        <Input
          value={(data.ifExpression as string | undefined) ?? ''}
          onChange={(v) => onChange({ ifExpression: v })}
          placeholder="{{.status}} == approved"
        />
      </Field>
      <p className="text-[10px] text-gray-400 leading-relaxed">
        Use <code className="bg-gray-100 px-0.5 rounded">{'{{.field}}'}</code> to reference the previous node&apos;s output. Supports <code className="bg-gray-100 px-0.5 rounded">==</code> and <code className="bg-gray-100 px-0.5 rounded">!=</code>.
      </p>
    </div>
  );
}

function RouterConfig({
  data,
  onChange,
}: {
  data: CanvasNodeData;
  onChange: (d: Partial<CanvasNodeData>) => void;
}) {
  const routes = (data.routes as { label: string; handle: string }[] | undefined) ?? [];

  function addRoute() {
    const next = [...routes, { label: `Route ${routes.length + 1}`, handle: `route-${Date.now()}` }];
    onChange({ routes: next });
  }

  function removeRoute(idx: number) {
    onChange({ routes: routes.filter((_, i) => i !== idx) });
  }

  function updateRoute(idx: number, field: 'label' | 'handle', val: string) {
    const next = routes.map((r, i) => (i === idx ? { ...r, [field]: val } : r));
    onChange({ routes: next });
  }

  return (
    <div className="space-y-3">
      <Field label="Routes">
        <div className="space-y-2">
          {routes.map((r, i) => (
            <div key={r.handle} className="flex items-center gap-1">
              <Input
                value={r.label}
                onChange={(v) => updateRoute(i, 'label', v)}
                placeholder="Route label"
              />
              <button
                onClick={() => removeRoute(i)}
                className="p-1 text-gray-400 hover:text-red-500 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addRoute}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
          >
            <Plus className="w-3 h-3" />
            Add route
          </button>
        </div>
      </Field>
    </div>
  );
}

function ParallelConfig({
  data,
  onChange,
}: {
  data: CanvasNodeData;
  onChange: (d: Partial<CanvasNodeData>) => void;
}) {
  return (
    <Field label="Number of branches">
      <Input
        value={String(data.branchCount ?? 2)}
        onChange={(v) => onChange({ branchCount: Math.max(2, Number(v) || 2) })}
        placeholder="2"
      />
    </Field>
  );
}

// ─── Inputs / Outputs sub-panel ────────────────────────────────────────────────

function IOPanel({
  data,
  onChange,
}: {
  data: CanvasNodeData;
  onChange: (d: Partial<CanvasNodeData>) => void;
}) {
  const inputs = (data.inputs as { name: string; type: string; required: boolean }[] | undefined) ?? [];
  const outputs = (data.outputs as { name: string; type: string; required: boolean }[] | undefined) ?? [];

  function addIO(key: 'inputs' | 'outputs') {
    const arr = key === 'inputs' ? inputs : outputs;
    onChange({ [key]: [...arr, { name: '', type: 'string', required: false }] });
  }

  function removeIO(key: 'inputs' | 'outputs', idx: number) {
    const arr = key === 'inputs' ? inputs : outputs;
    onChange({ [key]: arr.filter((_, i) => i !== idx) });
  }

  function updateIO(key: 'inputs' | 'outputs', idx: number, field: string, val: string | boolean) {
    const arr = key === 'inputs' ? [...inputs] : [...outputs];
    arr[idx] = { ...arr[idx], [field]: val };
    onChange({ [key]: arr });
  }

  function IORow({
    item,
    idx,
    ioKey,
  }: {
    item: { name: string; type: string; required: boolean };
    idx: number;
    ioKey: 'inputs' | 'outputs';
  }) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={item.name}
          onChange={(e) => updateIO(ioKey, idx, 'name', e.target.value)}
          placeholder="name"
          className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded outline-none focus:border-brand-400"
        />
        <select
          value={item.type}
          onChange={(e) => updateIO(ioKey, idx, 'type', e.target.value)}
          className="px-1.5 py-1 text-[11px] border border-gray-200 rounded outline-none focus:border-brand-400"
        >
          {['string', 'number', 'boolean', 'object', 'array'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="flex items-center gap-0.5 text-[10px] text-gray-500 shrink-0">
          <input
            type="checkbox"
            checked={item.required}
            onChange={(e) => updateIO(ioKey, idx, 'required', e.target.checked)}
            className="rounded"
          />
          req
        </label>
        <button onClick={() => removeIO(ioKey, idx)} className="p-0.5 text-gray-400 hover:text-red-500">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-600">Inputs</p>
          <button onClick={() => addIO('inputs')} className="text-[10px] text-brand-600 flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Add input
          </button>
        </div>
        <div className="space-y-1.5">
          {inputs.map((inp, i) => (
            <IORow key={i} item={inp} idx={i} ioKey="inputs" />
          ))}
          {inputs.length === 0 && <p className="text-[10px] text-gray-400">No inputs defined.</p>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-600">Outputs</p>
          <button onClick={() => addIO('outputs')} className="text-[10px] text-brand-600 flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Add output
          </button>
        </div>
        <div className="space-y-1.5">
          {outputs.map((out, i) => (
            <IORow key={i} item={out} idx={i} ioKey="outputs" />
          ))}
          {outputs.length === 0 && <p className="text-[10px] text-gray-400">No outputs defined.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function NodeConfigPanel({
  node,
  agents,
  onUpdate,
  onClose,
  onDelete,
}: NodeConfigPanelProps) {
  const kind = node.type as NodeKind;
  const meta = NODE_META[kind];
  const Icon = meta.icon;
  const data = node.data as CanvasNodeData;

  const [tab, setTab] = useState<Tab>('Configure');

  // Reset tab when node changes
  useEffect(() => { setTab('Configure'); }, [node.id]);

  function onChange(partial: Partial<CanvasNodeData>) {
    onUpdate(node.id, partial);
  }

  function renderConfigTab() {
    switch (kind) {
      case 'agent':        return <AgentConfig data={data} agents={agents} onChange={onChange} />;
      case 'agent_team':   return (
        <div className="space-y-3">
          <Field label="Supervisor agent">
            <Select
              value={data.agentId ?? ''}
              onChange={(v) => onChange({ agentId: v, entryAgentId: v })}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Field>
          <Field label="Max iterations">
            <Input
              value={String(data.maxIterations ?? 10)}
              onChange={(v) => onChange({ maxIterations: Math.max(1, Number(v) || 10) })}
              placeholder="10"
            />
          </Field>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-600 mb-2">Supervisor memory</p>
            <MemoryPanel data={data} onChange={onChange} />
          </div>
        </div>
      );
      case 'if_else':      return <IfElseConfig data={data} onChange={onChange} />;
      case 'human_review': return <p className="text-xs text-gray-500">No configuration required. The run pauses here and resumes when a human submits a decision via the Review dashboard.</p>;
      case 'router':       return <RouterConfig data={data} onChange={onChange} />;
      case 'parallel':     return <ParallelConfig data={data} onChange={onChange} />;
      default:             return <p className="text-xs text-gray-400">No configuration for {meta.label} nodes.</p>;
    }
  }

  return (
    <aside className="w-72 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-md flex items-center justify-center ${meta.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
          </span>
          <div>
            <p className="text-xs font-semibold text-gray-800">{data.label}</p>
            <p className="text-[10px] text-gray-400">{meta.label} node</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Name field (always shown) */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 shrink-0">
        <Field label="Name">
          <div className="flex items-center gap-1">
            <Input value={data.label} onChange={(v) => onChange({ label: v })} placeholder="Node name" />
            <span className="text-[10px] text-gray-400 shrink-0">{data.label.length}/50</span>
          </div>
        </Field>
        <Field label="Description">
          <textarea
            value={(data.description as string | undefined) ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="What does this node do?"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400 resize-none mt-1"
          />
        </Field>
      </div>

      {/* Tabs */}
      {(kind === 'agent_team' || kind === 'agent') && (
        <div className="flex border-b border-gray-100 shrink-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {tab === 'Configure' && renderConfigTab()}
        {tab === 'Members' && kind === 'agent_team' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Agent members of this team.</p>
            <Select
              value=""
              onChange={(v) => {
                if (!v) return;
                const prev = (data.memberAgentIds as string[] | undefined) ?? [];
                if (!prev.includes(v)) onChange({ memberAgentIds: [...prev, v] });
              }}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
            <ul className="space-y-1">
              {((data.memberAgentIds as string[] | undefined) ?? []).map((aid) => {
                const agent = agents.find((a) => a.id === aid);
                return (
                  <li key={aid} className="flex items-center justify-between text-xs px-2 py-1 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 truncate">{agent?.name ?? aid}</span>
                    <button
                      onClick={() =>
                        onChange({
                          memberAgentIds: ((data.memberAgentIds as string[] | undefined) ?? []).filter(
                            (id) => id !== aid,
                          ),
                        })
                      }
                      className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {tab === 'Settings' && <IOPanel data={data} onChange={onChange} />}

        {/* IO panel for non-team nodes on Configure tab */}
        {tab === 'Configure' && kind !== 'agent_team' && kind !== 'start' && kind !== 'end' && (
          <details className="group">
            <summary className="text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 flex items-center gap-1">
              <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
              Inputs / Outputs
            </summary>
            <div className="mt-2">
              <IOPanel data={data} onChange={onChange} />
            </div>
          </details>
        )}
      </div>

      {/* Delete footer */}
      {kind !== 'start' && (
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <button
            onClick={() => onDelete(node.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete node
          </button>
        </div>
      )}
    </aside>
  );
}
