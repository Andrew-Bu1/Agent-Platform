import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import {
  Database, FileText, Plus, Pencil, Trash2, Loader2,
  X, AlertCircle, ArrowLeft, Upload, Play, RefreshCw, RotateCcw,
  CheckCircle2, ChevronDown, ChevronRight, Layers, Sparkles,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { datasourcesApi, documentsApi, ingestionsApi, chunksApi, activeIngestionApi, dlqApi } from '../api/datahub';
import { modelsApi } from '../api/aihub';
import type { Datasource, Document, Ingestion, Chunk, CreateIngestionRequest, TriggerEmbedRequest, DlqEntry, DlqListResponse, ModelConfig } from '../types/api';

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
  const [mode, setMode]                         = useState<'full_pipeline' | 'chunk_only'>('full_pipeline');
  const [form, setForm] = useState({
    chunk_strategy:       'fixed_size',
    chunk_size:           '512',
    chunk_overlap:        '64',
    max_chunk_size:       '1024',
    similarity_threshold: '0.4',
    embedding_model:      '',
  });
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [embedModels, setEmbedModels]   = useState<ModelConfig[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  useEffect(() => {
    modelsApi.list({ operation_type: 'embed' })
      .then((list) => {
        setEmbedModels(list);
        if (list.length > 0) {
          setForm((f) => ({ ...f, embedding_model: f.embedding_model || list[0].model_key }));
        }
      })
      .catch(() => { /* fall back to free-text input */ })
      .finally(() => setLoadingModels(false));
  }, []);

  const set =
    (k: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const chunkConfig =
        form.chunk_strategy === 'semantic_chunking'
          ? { max_chunk_size: Number(form.max_chunk_size), similarity_threshold: Number(form.similarity_threshold) }
          : { chunk_size: Number(form.chunk_size), chunk_overlap: Number(form.chunk_overlap) };
      const body: CreateIngestionRequest = {
        mode,
        chunk_strategy:  form.chunk_strategy as CreateIngestionRequest['chunk_strategy'],
        chunk_config:    chunkConfig,
        ...(mode === 'full_pipeline' ? { embedding_model: form.embedding_model.trim() } : {}),
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

  const canSubmit = mode === 'chunk_only' || form.embedding_model.trim() !== '';

  return (
    <ModalShell title="Trigger ingestion" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {/* Mode tabs */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode('full_pipeline')}
            className={`flex-1 py-2.5 transition-colors ${mode === 'full_pipeline' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Chunk + Embed
          </button>
          <button
            type="button"
            onClick={() => setMode('chunk_only')}
            className={`flex-1 py-2.5 transition-colors border-l border-gray-200 ${mode === 'chunk_only' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Chunk only
          </button>
        </div>
        {mode === 'chunk_only' && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Chunks will be saved but not embedded. Use <strong>Embed into DB</strong> on the run row to embed later.
          </p>
        )}
        <Field label="Chunk strategy">
          <select value={form.chunk_strategy} onChange={set('chunk_strategy')} className={INPUT + ' bg-white'}>
            <option value="fixed_size">Fixed size</option>
            <option value="recursive_split">Recursive split</option>
            <option value="semantic_chunking">Semantic chunking</option>
          </select>
        </Field>
        {form.chunk_strategy === 'semantic_chunking' ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max chunk size">
              <input type="number" min="1" value={form.max_chunk_size} onChange={set('max_chunk_size')} className={INPUT} />
            </Field>
            <Field label="Similarity threshold">
              <input type="number" min="0" max="1" step="0.01" value={form.similarity_threshold} onChange={set('similarity_threshold')} className={INPUT} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Chunk size">
              <input type="number" value={form.chunk_size}    onChange={set('chunk_size')}    className={INPUT} />
            </Field>
            <Field label="Chunk overlap">
              <input type="number" value={form.chunk_overlap} onChange={set('chunk_overlap')} className={INPUT} />
            </Field>
          </div>
        )}
        {mode === 'full_pipeline' && (
          <Field label="Embedding model *">
            {loadingModels ? (
              <div className={INPUT + ' flex items-center gap-2 text-gray-400'}>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading models…
              </div>
            ) : embedModels.length > 0 ? (
              <select required value={form.embedding_model} onChange={set('embedding_model')} className={INPUT + ' bg-white'}>
                {embedModels.map((m) => (
                  <option key={m.id} value={m.model_key}>{m.display_name}</option>
                ))}
              </select>
            ) : (
              <input
                required
                value={form.embedding_model}
                onChange={set('embedding_model')}
                placeholder="text-embedding-3-small"
                className={INPUT}
              />
            )}
          </Field>
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
            disabled={loading || !canSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'chunk_only' ? 'Chunk document' : 'Run ingestion'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Embed modal ──────────────────────────────────────────────────────────────

function EmbedModal({
  ingestion,
  onClose,
  onSaved,
}: {
  ingestion: Ingestion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [embedModels, setEmbedModels]       = useState<ModelConfig[]>([]);
  const [loadingModels, setLoadingModels]   = useState(true);

  useEffect(() => {
    modelsApi.list({ operation_type: 'embed' })
      .then((list) => {
        setEmbedModels(list);
        if (list.length > 0) setEmbeddingModel(list[0].model_key);
      })
      .catch(() => {})
      .finally(() => setLoadingModels(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: TriggerEmbedRequest = { embedding_model: embeddingModel.trim() };
      await ingestionsApi.embed(ingestion.id, body);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trigger embedding.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Embed into DB" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <p className="text-sm text-gray-500">
          Select an embedding model to embed the <strong>{ingestion.chunk_strategy}</strong> chunks from this run into the vector store.
        </p>
        <Field label="Embedding model *">
          {loadingModels ? (
            <div className={INPUT + ' flex items-center gap-2 text-gray-400'}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading models…
            </div>
          ) : embedModels.length > 0 ? (
            <select required value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)} className={INPUT + ' bg-white'}>
              {embedModels.map((m) => (
                <option key={m.id} value={m.model_key}>{m.display_name}</option>
              ))}
            </select>
          ) : (
            <input
              required
              autoFocus
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              placeholder="text-embedding-3-small"
              className={INPUT}
            />
          )}
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
            disabled={loading || !embeddingModel.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Sparkles className="w-4 h-4" />
            Embed into DB
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Ingestion status badge ───────────────────────────────────────────────────

const INGESTION_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  chunked:    'bg-purple-100 text-purple-700',
  completed:  'bg-emerald-100 text-emerald-700',
  failed:     'bg-red-100 text-red-700',
};

// ─── Chunk panel ──────────────────────────────────────────────────────────────

function ChunkPanel({ ingestionId }: { ingestionId: string }) {
  const [chunks, setChunks]   = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    chunksApi.listByIngestion(ingestionId)
      .then(setChunks)
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, [ingestionId]);

  if (loading) {
    return (
      <tr>
        <td colSpan={7} className="px-5 py-6 text-center text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin inline" />
        </td>
      </tr>
    );
  }
  if (chunks.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-5 py-4 text-center text-sm text-gray-400">No chunks found for this ingestion.</td>
      </tr>
    );
  }
  return (
    <>
      {chunks.map((chunk) => (
        <tr key={chunk.id} className="bg-slate-50 border-t border-slate-100">
          <td className="px-5 py-2.5 pl-12 text-xs text-gray-400 font-mono">{chunk.chunk_index}</td>
          <td colSpan={4} className="px-3 py-2.5 text-xs text-gray-700 whitespace-pre-wrap break-words max-w-lg">
            {chunk.content}
          </td>
          <td className="px-5 py-2.5 text-xs text-gray-400 font-mono">{chunk.id.slice(0, 8)}…</td>
        </tr>
      ))}
    </>
  );
}

// ─── Document detail — ingestions ─────────────────────────────────────────────

function DocumentDetail({
  document: initialDoc,
  onBack,
  onDeleted,
}: {
  document: Document;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [doc, setDoc]                         = useState<Document>(initialDoc);
  const [ingestions, setIngestions]           = useState<Ingestion[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [showModal, setShowModal]             = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingActive, setSettingActive]     = useState<string | null>(null);
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [embedIngestion, setEmbedIngestion]   = useState<Ingestion | null>(null);
  const [deletingIngestion, setDeletingIngestion] = useState<string | null>(null);
  const [confirmDeleteIngestion, setConfirmDeleteIngestion] = useState<Ingestion | null>(null);

  async function load() {
    setLoading(true);
    try { setIngestions(await ingestionsApi.listByDocument(doc.id)); } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [doc.id]);

  async function handleSetActive(ing: Ingestion) {
    setSettingActive(ing.id);
    try {
      const updated = await activeIngestionApi.set(doc.id, ing.id);
      setDoc(updated);
    } catch { /* ignore */ } finally { setSettingActive(null); }
  }

  async function doDelete() {
    setDeleting(true);
    try { await documentsApi.delete(doc.id); onDeleted(); } catch { setDeleting(false); }
  }

  async function handleDeleteIngestion(ing: Ingestion) {
    setDeletingIngestion(ing.id);
    try {
      await ingestionsApi.delete(ing.id);
      await load();
    } catch { /* ignore */ } finally { setDeletingIngestion(null); }
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
        <span className="font-semibold text-gray-900 truncate max-w-xs">{doc.name}</span>
        {doc.active_ingestion_id ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> Search active
          </span>
        ) : (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
            No active ingestion — not searchable
          </span>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
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
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8" />
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Strategy</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Embedding model</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Started</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ingestions.map((ing) => {
                const isActive   = doc.active_ingestion_id === ing.id;
                const isExpanded = expandedId === ing.id;
                return (
                  <>
                    <tr
                      key={ing.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : ing.id)}
                    >
                      <td className="px-5 py-3 text-gray-400">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">{ing.chunk_strategy}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{ing.embedding_model || <span className="text-gray-300 italic">none</span>}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INGESTION_COLORS[ing.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ing.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">{fmt(ing.created_at)}</td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        {isActive ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : ing.status === 'completed' ? (
                          <button
                            disabled={!!settingActive}
                            onClick={() => handleSetActive(ing)}
                            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50 transition-colors"
                          >
                            {settingActive === ing.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Layers className="w-3 h-3" />}
                            Set active
                          </button>
                        ) : ing.status === 'chunked' ? (
                          <button
                            onClick={() => setEmbedIngestion(ing)}
                            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            Embed into DB
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={deletingIngestion === ing.id}
                          onClick={() => setConfirmDeleteIngestion(ing)}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete ingestion run"
                        >
                          {deletingIngestion === ing.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && <ChunkPanel ingestionId={ing.id} />}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <IngestionModal
          documentId={doc.id}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
      {embedIngestion && (
        <EmbedModal
          ingestion={embedIngestion}
          onClose={() => setEmbedIngestion(null)}
          onSaved={load}
        />
      )}
      {confirmDeleteIngestion && (
        <ConfirmDialog
          title="Delete Ingestion Run"
          message={`Delete this ${confirmDeleteIngestion.chunk_strategy} ingestion run? Chunks and embeddings will also be removed.`}
          onConfirm={() => { const ing = confirmDeleteIngestion; setConfirmDeleteIngestion(null); handleDeleteIngestion(ing); }}
          onCancel={() => setConfirmDeleteIngestion(null)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Document"
          message={`Delete document "${doc.name}"?`}
          onConfirm={() => { setShowDeleteConfirm(false); doDelete(); }}
          onCancel={() => setShowDeleteConfirm(false)}
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

  async function loadDocuments() {
    setLoading(true);
    try { setDocuments(await documentsApi.listByDatasource(ds.id)); } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadDocuments(); }, [ds.id]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File exceeds the 100 MB limit.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      await documentsApi.upload(ds.id, file);
      await loadDocuments();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 413) {
        setUploadError('File exceeds the 100 MB limit.');
      } else {
        setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      }
    } finally {
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

        {uploadError && (
          <div className="px-5 py-3">
            <ErrorMsg message={uploadError} />
          </div>
        )}
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
  const [confirmAction, setConfirmAction] = useState<'replay' | 'clear' | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try { setData(await dlqApi.list()); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load DLQ.'); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function doReplay() {
    setReplaying(true);
    try { await dlqApi.replay(); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Replay failed.'); setReplaying(false); }
  }

  async function doClear() {
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
            onClick={() => setConfirmAction('replay')}
            disabled={replaying || entries.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {replaying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Replay all
          </button>
          <button
            onClick={() => setConfirmAction('clear')}
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
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction === 'replay' ? 'Replay DLQ' : 'Clear DLQ'}
          message={confirmAction === 'replay'
            ? 'Re-enqueue all DLQ entries to the ingestion queue?'
            : 'Permanently delete all DLQ entries?'}
          confirmLabel={confirmAction === 'replay' ? 'Replay all' : 'Clear all'}
          variant={confirmAction === 'replay' ? 'warning' : 'danger'}
          onConfirm={() => { const a = confirmAction; setConfirmAction(null); a === 'replay' ? doReplay() : doClear(); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try { setDatasources(await datasourcesApi.list()); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Failed to load datasources.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function doDelete(id: string) {
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
      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete Datasource"
          message="Delete this datasource and all its documents?"
          onConfirm={() => { const id = confirmDeleteId; setConfirmDeleteId(null); doDelete(id); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      </>)}
    </div>
  );
}
