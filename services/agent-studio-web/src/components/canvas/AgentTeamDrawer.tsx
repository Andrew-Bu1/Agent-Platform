import { useState, useEffect, useCallback } from 'react';
import { type Node } from '@xyflow/react';
import {
  X, Plus, Trash2, Crown, Users, ChevronDown,
  Loader2, Bot, Pencil, Check, Search,
} from 'lucide-react';
import { agentsApi } from '../../api/agents';
import type { Agent, CreateAgentRequest } from '../../types/api';
import type { CanvasNodeData } from '../../types/canvas';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_KINDS = [
  { value: 'react',  label: 'ReAct' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'simple', label: 'Simple' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const KIND_COLOR: Record<string, string> = {
  react:  'bg-violet-100 text-violet-700',
  openai: 'bg-green-100 text-green-700',
  simple: 'bg-gray-100 text-gray-600',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgentAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center shrink-0`}>
      {initials(name)}
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${KIND_COLOR[kind] ?? 'bg-gray-100 text-gray-600'}`}>
      {kind}
    </span>
  );
}

/** Compact card for an already-selected agent */
function AgentCard({
  agent,
  isSupervisor,
  onRemove,
  onEdit,
  isEditing,
}: {
  agent: Agent;
  isSupervisor?: boolean;
  onRemove: () => void;
  onEdit: () => void;
  isEditing: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 p-3 rounded-xl border transition-all',
        isEditing
          ? 'border-brand-300 bg-brand-50 shadow-sm'
          : isSupervisor
            ? 'border-amber-200 bg-amber-50'
            : 'border-gray-200 bg-white hover:border-gray-300',
      ].join(' ')}
    >
      <AgentAvatar name={agent.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isSupervisor && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
          <p className="text-xs font-semibold text-gray-800 truncate">{agent.name}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <KindBadge kind={agent.agentKind} />
          {agent.modelId && (
            <span className="text-[10px] text-gray-400 truncate">{agent.modelId}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          title="Quick-edit"
          className={`p-1 rounded transition-colors ${isEditing ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          title="Remove"
          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Inline create-agent form */
function CreateAgentForm({
  onCreated,
  onCancel,
}: {
  onCreated: (agent: Agent) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CreateAgentRequest>({
    name: '',
    agentKind: 'react',
    modelId: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const created = await agentsApi.create({
        ...form,
        modelId: form.modelId?.trim() || undefined,
        description: form.description?.trim() || undefined,
      });
      onCreated(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create agent.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 p-3 space-y-2.5">
      <p className="text-xs font-semibold text-brand-700 flex items-center gap-1.5">
        <Bot className="w-3.5 h-3.5" />
        Quick-create agent
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Name *</label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Research Agent"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Kind</label>
          <div className="relative">
            <select
              value={form.agentKind}
              onChange={(e) => setForm((f) => ({ ...f, agentKind: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400 appearance-none bg-white pr-6"
            >
              {AGENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Model</label>
          <input
            value={form.modelId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
            placeholder="gpt-4o"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Description</label>
          <input
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What does this agent do?"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400"
          />
        </div>
      </div>

      {err && <p className="text-[10px] text-red-600">{err}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors font-medium"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Create & add
        </button>
      </div>
    </div>
  );
}

/** Search + pick from existing agents */
function AgentPicker({
  agents,
  excludeIds,
  onPick,
  placeholder,
}: {
  agents: Agent[];
  excludeIds: string[];
  onPick: (agent: Agent) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = agents
    .filter((a) => !excludeIds.includes(a.id))
    .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white">
        <Search className="w-3 h-3 text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? 'Search agents…'}
          className="flex-1 text-xs outline-none"
        />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No agents found.</p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { onPick(a); setQuery(''); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <AgentAvatar name={a.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{a.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <KindBadge kind={a.agentKind} />
                      {a.modelId && <span className="text-[10px] text-gray-400">{a.modelId}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

interface AgentTeamDrawerProps {
  node: Node;
  agents: Agent[];
  onUpdate: (nodeId: string, data: Partial<CanvasNodeData>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onAgentCreated: (agent: Agent) => void;
}

export default function AgentTeamDrawer({
  node,
  agents,
  onUpdate,
  onClose,
  onDelete,
  onAgentCreated,
}: AgentTeamDrawerProps) {
  const data = node.data as CanvasNodeData;

  // Resolve agent objects from stored IDs
  const supervisorId  = (data.entryAgentId as string | undefined) ?? '';
  const memberIds     = (data.memberAgentIds as string[] | undefined) ?? [];
  const supervisor    = agents.find((a) => a.id === supervisorId) ?? null;
  const members       = memberIds.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as Agent[];

  // Which panel is open: 'supervisor-search' | 'supervisor-create' | 'member-search' | 'member-create' | null
  const [addMode, setAddMode] = useState<'supervisor-search' | 'supervisor-create' | 'member-search' | 'member-create' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reset add-mode when node changes
  useEffect(() => { setAddMode(null); setEditingId(null); }, [node.id]);

  const update = useCallback(
    (partial: Partial<CanvasNodeData>) => onUpdate(node.id, partial),
    [node.id, onUpdate],
  );

  // ── Supervisor actions ───────────────────────────────────────────────────
  function setSupervisor(agent: Agent) {
    update({ entryAgentId: agent.id, agentId: agent.id });
    setAddMode(null);
  }

  function removeSupervisor() {
    update({ entryAgentId: '', agentId: '' });
  }

  // ── Member actions ───────────────────────────────────────────────────────
  function addMember(agent: Agent) {
    if (memberIds.includes(agent.id)) return;
    update({ memberAgentIds: [...memberIds, agent.id] });
    setAddMode(null);
  }

  function removeMember(id: string) {
    update({ memberAgentIds: memberIds.filter((mid) => mid !== id) });
  }

  // ── Inline create callbacks ──────────────────────────────────────────────
  function handleSupervisorCreated(agent: Agent) {
    onAgentCreated(agent);
    setSupervisor(agent);
  }

  function handleMemberCreated(agent: Agent) {
    onAgentCreated(agent);
    addMember(agent);
  }

  // All IDs already in the team (to exclude from pickers)
  const usedIds = [supervisorId, ...memberIds].filter(Boolean);

  return (
    <>
      {/* Backdrop (subtle) */}
      <div
        className="absolute inset-0 z-20"
        style={{ backdropFilter: 'none', pointerEvents: 'none' }}
      />

      {/* Drawer */}
      <aside
        className="absolute top-0 right-0 bottom-0 z-30 w-[560px] bg-white border-l border-gray-200 shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.18s ease-out' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              className="text-sm font-semibold text-gray-900 outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-400 w-full truncate"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Agent Team node</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Team meta */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-[11px] text-blue-700 leading-relaxed">
                <span className="font-semibold">Supervisor handoff</span> — the supervisor LLM decides at runtime which member agent to call next. Use the canvas <span className="font-semibold">Router</span> node for deterministic routing.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  value={(data.description as string | undefined) ?? ''}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="What does this team do?"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400"
                />
              </div>
              <div className="w-24 shrink-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Max iterations</label>
                <input
                  type="number"
                  min={1}
                  value={String(data.maxIterations ?? '')}
                  onChange={(e) => update({ maxIterations: Number(e.target.value) || undefined })}
                  placeholder="3"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400"
                />
              </div>
            </div>
          </div>

          {/* ── Supervisor ─────────────────────────────────────────────────── */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-xs font-semibold text-gray-700">Supervisor</p>
              </div>
              {!supervisor && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAddMode(addMode === 'supervisor-search' ? null : 'supervisor-search')}
                    className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                  >
                    <Search className="w-3 h-3" /> Pick existing
                  </button>
                  <button
                    onClick={() => setAddMode(addMode === 'supervisor-create' ? null : 'supervisor-create')}
                    className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Create new
                  </button>
                </div>
              )}
            </div>

            {supervisor ? (
              <AgentCard
                agent={supervisor}
                isSupervisor
                onRemove={removeSupervisor}
                onEdit={() => setEditingId(editingId === supervisor.id ? null : supervisor.id)}
                isEditing={editingId === supervisor.id}
              />
            ) : (
              <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 flex items-center justify-center py-5 text-xs text-amber-500">
                No supervisor assigned
              </div>
            )}

            {addMode === 'supervisor-search' && (
              <div className="mt-3">
                <AgentPicker
                  agents={agents}
                  excludeIds={usedIds}
                  onPick={setSupervisor}
                  placeholder="Search for supervisor…"
                />
              </div>
            )}
            {addMode === 'supervisor-create' && (
              <div className="mt-3">
                <CreateAgentForm
                  onCreated={handleSupervisorCreated}
                  onCancel={() => setAddMode(null)}
                />
              </div>
            )}
          </div>

          {/* ── Members ──────────────────────────────────────────────────────── */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-700">
                Team Members
                <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full font-normal">
                  {members.length}
                </span>
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setAddMode(addMode === 'member-search' ? null : 'member-search')}
                  className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                >
                  <Search className="w-3 h-3" /> Pick existing
                </button>
                <button
                  onClick={() => setAddMode(addMode === 'member-create' ? null : 'member-create')}
                  className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Create new
                </button>
              </div>
            </div>

            {addMode === 'member-search' && (
              <div className="mb-3">
                <AgentPicker
                  agents={agents}
                  excludeIds={usedIds}
                  onPick={addMember}
                  placeholder="Search to add member…"
                />
              </div>
            )}
            {addMode === 'member-create' && (
              <div className="mb-3">
                <CreateAgentForm
                  onCreated={handleMemberCreated}
                  onCancel={() => setAddMode(null)}
                />
              </div>
            )}

            {members.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center py-8 text-xs text-gray-400">
                No members yet — add agents above
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((agent, idx) => (
                  <div key={agent.id}>
                    <div className="flex items-start gap-2">
                      <span className="mt-3.5 text-[10px] font-medium text-gray-400 w-4 shrink-0 text-right">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <AgentCard
                          agent={agent}
                          onRemove={() => removeMember(agent.id)}
                          onEdit={() => setEditingId(editingId === agent.id ? null : agent.id)}
                          isEditing={editingId === agent.id}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Exit agent */}
            {members.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Exit agent
                  <span className="ml-1 text-[10px] text-gray-400 font-normal">(outputs back to parent flow)</span>
                </label>
                <div className="relative">
                  <select
                    value={(data.exitAgentId as string | undefined) ?? ''}
                    onChange={(e) => update({ exitAgentId: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-brand-400 appearance-none bg-white pr-7"
                  >
                    <option value="">— Same as supervisor —</option>
                    {[...(supervisor ? [supervisor] : []), ...members].map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={() => onDelete(node.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete node
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors font-medium"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
