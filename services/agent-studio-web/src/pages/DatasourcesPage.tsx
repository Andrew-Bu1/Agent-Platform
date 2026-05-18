import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import {
  Database, FileText, Plus, Pencil, Trash2, Loader2,
  X, AlertCircle, ArrowLeft, Upload, Play, RefreshCw, RotateCcw,
} from 'lucide-react';
import { datasourcesApi, documentsApi, ingestionsApi, dlqApi } from '../api/datahub';
import type { Datasource, Document, Ingestion, CreateIngestionRequest, DlqEntry, DlqListResponse } from '../types/api';

// ─── Shared UI ────────────────────────────────────────────────────────────────

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

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
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
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

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Datasource modal ─────────────────────────────────────────────────────────

function DatasourceModal({
  ds,
  onClose,
  onSaved,
}: {
  ds: Datasource | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!ds;
  const [name, setName]               = useState(ds?.name        ?? '');
  const [description, setDescription] = useState(ds?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = { name: name.trim(), description: description.trim() || undefined };
      if (isEdit) {
        await datasourcesApi.update(ds!.id, body);
      } else {
        await datasourcesApi.create(body);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={isEdit ? 'Edit datasource' : 'New datasource'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label="Name *">
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My documents"
            className={INPUT}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={INPUT + ' resize-none'}
            placeholder="Optional description"
          />
        </Field>
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
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Ingestion modal ──────────────────────────────────────────────────────────

function IngestionModal({
  documentId,
  onClose,
  onSaved,
}: {
  documentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    chunk_strategy:  'fixed',
    chunk_size:      '512',
    chunk_overlap:   '64',
    embedding_model: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: CreateIngestionRequest = {
        chunk_strategy: form.chunk_strategy,
        chunk_config: {
          chunk_size:    Number(form.chunk_size),
          chunk_overlap: Number(form.chunk_overlap),
        },
        embedding_model: form.embedding_model.trim(),
      };
      await ingestionsApi.trigger(documentId, body);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trigger ingestion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Trigger ingestion" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <Field label="Chunk strategy">
          <select value={form.chunk_strategy} onChange={set('chunk_strategy')} className={INPUT + ' bg-white'}>
            <option value="fixed">Fixed size</option>
            <option value="sentence">Sentence</option>
            <option value="paragraph">Paragraph</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Chunk size">
            <input type="number" value={form.chunk_size}    onChange={set('chunk_size')}    className={INPUT} />
          </Field>
          <Field label="Chunk overlap">
            <input type="number" value={form.chunk_overlap} onChange={set('chunk_overlap')} className={INPUT} />
          </Field>
        </div>
        <Field label="Embedding model key *">
          <input
            required
            autoFocus
            value={form.embedding_model}
            onChange={set('embedding_model')}
            placeholder="text-embedding-3-small"
            className={INPUT}
          />
        </Field>
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
            disabled={loading || !form.embedding_model.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Run ingestion
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Ingestion status badge ───────────────────────────────────────────────────

const INGESTION_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed:    'bg-red-100 text-red-700',
};

// ─── Document detail — ingestions ─────────────────────────────────────────────

function DocumentDetail({
  document,
  onBack,
  onDeleted,
}: {
  document: Document;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [ingestions, setIngestions]       = useState<Ingestion[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [deleting, setDeleting]           = useState(false);

  async function load() {
    setLoading(true);
    try { setIngestions(await ingestionsApi.listByDocument(document.id)); } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [document.id]);

  async function handleDelete() {
    if (!confirm(`Delete document "${document.name}"?`)) return;
    setDeleting(true);
    try { await documentsApi.delete(document.id); onDeleted(); } catch { setDeleting(false); }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2.5 text-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Documents
        </button>
        <span className="text-gray-300">/</span>
        <FileText className="w-4 h-4 text-gray-400" />
        <span className="font-semibold text-gray-900 truncate max-w-xs">{document.name}</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Ingestions table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Ingestion runs</span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Trigger ingestion
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : ingestions.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No ingestion runs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Strategy</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Embedding model</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ingestions.map((ing) => (
                <tr key={ing.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{ing.chunk_strategy}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{ing.embedding_model}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INGESTION_COLORS[ing.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {ing.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{fmt(ing.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <IngestionModal
          documentId={document.id}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ─── Datasource detail — documents ───────────────────────────────────────────

function DatasourceDetail({
  ds,
  onBack,
}: {
  ds: Datasource;
  onBack: () => void;
}) {
  const [documents, setDocuments]     = useState<Document[]>([]);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    setLoading(true);
    try { setDocuments(await documentsApi.listByDatasource(ds.id)); } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadDocuments(); }, [ds.id]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await documentsApi.upload(ds.id, file); await loadDocuments(); } catch { /* ignore */ } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (selectedDoc) {
    return (
      <DocumentDetail
        document={selectedDoc}
        onBack={() => setSelectedDoc(null)}
        onDeleted={() => { setSelectedDoc(null); loadDocuments(); }}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2.5 text-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Datasources
        </button>
        <span className="text-gray-300">/</span>
        <Database className="w-4 h-4 text-emerald-500" />
        <span className="font-semibold text-gray-900">{ds.name}</span>
        {ds.description && <span className="text-xs text-gray-400 truncate max-w-xs">{ds.description}</span>}
      </div>

      {/* Documents table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </span>
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {uploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            No documents yet. Upload a file to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedDoc(doc)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{fmt(doc.created_at)}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-brand-600 font-medium">
                    View ingestions →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── DLQ Admin ────────────────────────────────────────────────────────────────

function DlqAdmin() {
  const [data, setData]         = useState<DlqListResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try { setData(await dlqApi.list()); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load DLQ.'); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleReplay() {
    if (!confirm('Re-enqueue all DLQ entries to the ingestion queue?')) return;
    setReplaying(true);
    try { await dlqApi.replay(); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Replay failed.'); setReplaying(false); }
  }

  async function handleClear() {
    if (!confirm('Permanently delete all DLQ entries?')) return;
    setClearing(true);
    try { await dlqApi.clear(); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Clear failed.'); setClearing(false); }
  }

  const entries: DlqEntry[] = data?.entries ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Ingestion DLQ</h3>
          <p className="text-sm text-gray-500 mt-0.5">Failed ingestion jobs held in the dead-letter queue.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
          <button
            onClick={handleReplay}
            disabled={replaying || entries.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {replaying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Replay all
          </button>
          <button
            onClick={handleClear}
            disabled={clearing || entries.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear all
          </button>
        </div>
      </div>

      {error && <ErrorMsg message={error} />}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">
            {data ? `${data.total} entr${data.total !== 1 ? 'ies' : 'y'}` : '—'}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">Dead-letter queue is empty.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry, i) => (
              <div key={i} className="px-5 py-4 space-y-1.5">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{entry.queue}</span>
                  <span>{fmt(entry.queued_at)}</span>
                </div>
                <p className="text-xs text-red-600 font-medium">{entry.error}</p>
                <pre className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(entry.payload), null, 2); } catch { return entry.payload; }
                  })()}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'datasources' | 'dlq';

export default function DatasourcesPage() {
  const [tab, setTab]                 = useState<Tab>('datasources');
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [modal, setModal]             = useState<Datasource | null | 'new'>(null);
  const [selected, setSelected]       = useState<Datasource | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try { setDatasources(await datasourcesApi.list()); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Failed to load datasources.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this datasource and all its documents?')) return;
    setDeleting(id);
    try { await datasourcesApi.delete(id); await load(); } catch { /* ignore */ } finally { setDeleting(null); }
  }

  if (selected) {
    return <DatasourceDetail ds={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Datasources</h2>
          <p className="text-sm text-gray-500 mt-0.5">Document collections for retrieval-augmented agents</p>
        </div>
        {tab === 'datasources' && (
          <button
            onClick={() => setModal('new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New datasource
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['datasources', 'dlq'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'datasources' ? 'Datasources' : 'DLQ Admin'}
          </button>
        ))}
      </div>

      {tab === 'dlq' && <DlqAdmin />}
      {tab === 'datasources' && (<>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center py-24 gap-3 text-gray-500">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-600">{loadError}</p>
          <button onClick={load} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Retry</button>
        </div>
      ) : datasources.length === 0 ? (
        <div className="text-center py-24 text-gray-400 space-y-3">
          <Database className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-sm">No datasources yet.</p>
          <button
            onClick={() => setModal('new')}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Create one →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {datasources.map((ds) => (
                <tr
                  key={ds.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelected(ds)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Database className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium text-gray-900">{ds.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs max-w-xs truncate">
                    {ds.description ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{fmt(ds.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <div
                      className="flex items-center gap-1 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setModal(ds)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ds.id)}
                        disabled={deleting === ds.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {deleting === ds.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <DatasourceModal
          ds={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      </>)}
    </div>
  );
}
