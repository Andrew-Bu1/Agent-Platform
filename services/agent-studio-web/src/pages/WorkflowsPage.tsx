import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus, Trash2, Loader2, X, AlertCircle, Tag, Clock, Pencil } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { flowsApi } from '../api/flows';
import type { Flow, FlowVersion } from '../types/api';

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateFlowModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await flowsApi.create({ name: name.trim(), description: description.trim() || undefined });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New workflow</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer support flow"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this workflow do?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create workflow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Versions panel ───────────────────────────────────────────────────────────

function VersionsPanel({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  useEffect(() => {
    flowsApi.listVersions(flow.id)
      .then((page) => setVersions(page.content))
      .finally(() => setLoading(false));
  }, [flow.id]);

  async function doPublish() {
    const draftVersion = versions.find((v) => v.status === 'draft') ?? versions[0];
    if (!draftVersion) return;
    setPublishing(true);
    try {
      await flowsApi.publishVersion(flow.id, draftVersion.id);
      onClose();
    } catch {
      // ignore
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{flow.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">No versions yet.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <Tag className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      v{v.version}
                      {v.status === 'published' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-semibold">published</span>
                      )}
                      {v.status === 'draft' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full font-semibold">draft</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Close</button>
          <button
            onClick={() => setShowPublishConfirm(true)}
            disabled={publishing || versions.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
            Publish latest
          </button>
        </div>
      </div>
      {showPublishConfirm && (
        <ConfirmDialog
          title="Publish Workflow"
          message="Publish the latest version of this workflow?"
          confirmLabel="Publish"
          variant="warning"
          onConfirm={() => { setShowPublishConfirm(false); doPublish(); }}
          onCancel={() => setShowPublishConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [versionsFlow, setVersionsFlow] = useState<Flow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await flowsApi.list(p, 20);
      setFlows(res.content);
      setTotal(res.totalElements);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function doDelete(id: string) {
    setDeleting(id);
    try {
      await flowsApi.delete(id);
      load();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Workflows</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} workflow{total !== 1 ? 's' : ''} in this workspace</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New workflow
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <GitBranch className="w-10 h-10" />
            <p className="text-sm">No workflows yet. Create your first one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Published version</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {flows.map((flow) => (
                <tr key={flow.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <GitBranch className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{flow.name}</p>
                        {flow.description && (
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">{flow.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {flow.status === 'active' ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                        Published
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs capitalize">{flow.status}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(flow.updatedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/workflows/${flow.id}/edit`)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-brand-50 border border-brand-200 text-brand-600 hover:bg-brand-100 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => setVersionsFlow(flow)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Versions
                      </button>
                      <button
                        onClick={() => handleDelete(flow.id)}
                        disabled={deleting === flow.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === flow.id
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

      {showCreate && <CreateFlowModal onClose={() => setShowCreate(false)} onSaved={() => load()} />}
      {versionsFlow && <VersionsPanel flow={versionsFlow} onClose={() => setVersionsFlow(null)} />}
      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete Workflow"
          message="Delete this workflow? All versions will be removed."
          onConfirm={() => { const id = confirmDeleteId; setConfirmDeleteId(null); doDelete(id); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
