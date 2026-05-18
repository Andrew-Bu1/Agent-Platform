import { useState, useEffect, type FormEvent } from 'react';
import { Bot, Plus, Pencil, Trash2, Loader2, X, AlertCircle, Key } from 'lucide-react';
import { agentsApi } from '../api/agents';
import type { Agent, CreateAgentRequest } from '../types/api';

const KIND_PERMISSIONS: Record<string, string[]> = {
  llm:          ['model:invoke'],
  tool_calling: ['model:invoke'],
  react:        ['model:invoke', 'agent:run'],
  chain:        ['model:invoke', 'flow:run'],
  custom:       [],
};

const AGENT_KINDS = ['llm', 'tool_calling', 'react', 'chain', 'custom'];

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
  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [agentKind, setAgentKind] = useState(agent?.agentKind ?? 'llm');
  const [modelId, setModelId] = useState(agent?.modelId ?? '');
  const [toolIds, setToolIds] = useState((agent?.toolIds ?? []).join(', '));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: CreateAgentRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        agentKind,
        modelId: modelId.trim() || undefined,
        toolIds: toolIds.split(',').map((s) => s.trim()).filter(Boolean),
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
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit agent' : 'New agent'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My agent"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Agent kind *</label>
              <select
                value={agentKind}
                onChange={(e) => setAgentKind(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
              >
                {AGENT_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Model ID</label>
              <input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="gpt-4o"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tool IDs (comma-separated)</label>
            <input
              value={toolIds}
              onChange={(e) => setToolIds(e.target.value)}
              placeholder="uuid1, uuid2"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Platform permissions — derived from kind, read-only */}
          <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
            <Key className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Platform permissions (determined by kind)</p>
              <div className="flex flex-wrap gap-1.5">
                {(KIND_PERMISSIONS[agentKind] ?? []).length === 0 ? (
                  <span className="text-xs text-gray-400 italic">None required</span>
                ) : (
                  (KIND_PERMISSIONS[agentKind] ?? []).map((k) => (
                    <span key={k} className="px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-mono rounded-lg border border-brand-200">{k}</span>
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
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  llm:          'bg-blue-100 text-blue-700',
  tool_calling: 'bg-orange-100 text-orange-700',
  react:        'bg-purple-100 text-purple-700',
  chain:        'bg-teal-100 text-teal-700',
  custom:       'bg-gray-100 text-gray-700',
};

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
