import { useState, useEffect, type FormEvent } from 'react';
import { Wrench, Plus, Pencil, Trash2, Loader2, X, AlertCircle } from 'lucide-react';
import { toolsApi } from '../api/tools';
import type { Tool, CreateToolRequest } from '../types/api';

const TOOL_TYPES = ['http_api', 'function', 'code', 'database', 'custom'];

const TYPE_COLORS: Record<string, string> = {
  http_api:  'bg-sky-100 text-sky-700',
  function:  'bg-amber-100 text-amber-700',
  code:      'bg-violet-100 text-violet-700',
  database:  'bg-emerald-100 text-emerald-700',
  custom:    'bg-gray-100 text-gray-700',
};

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
  const [name, setName] = useState(tool?.name ?? '');
  const [description, setDescription] = useState(tool?.description ?? '');
  const [toolType, setToolType] = useState(tool?.toolType ?? 'http_api');
  const [configRaw, setConfigRaw] = useState(
    tool?.config ? JSON.stringify(tool.config, null, 2) : '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let config: Record<string, unknown> = {};
    if (configRaw.trim()) {
      try {
        config = JSON.parse(configRaw);
      } catch {
        setError('Config must be valid JSON.');
        return;
      }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit tool' : 'New tool'}
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
              placeholder="My tool"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this tool do?"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tool type *</label>
            <select
              value={toolType}
              onChange={(e) => setToolType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
            >
              {TOOL_TYPES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Config (JSON)</label>
            <textarea
              value={configRaw}
              onChange={(e) => setConfigRaw(e.target.value)}
              placeholder='{ "url": "https://api.example.com", "method": "GET" }'
              rows={5}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none font-mono"
            />
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
