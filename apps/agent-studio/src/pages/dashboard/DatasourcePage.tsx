import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { datasourcesApi, documentsApi, ingestionsApi } from '@/lib/api/datahub'
import type {
  CreateIngestionRequest,
  DatasourceResponse,
  DocumentResponse,
  IngestionResponse,
  IngestionStatus,
} from '@/lib/api/datahub-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { cn } from '@/lib/cn'

// ---- Ingestion status badge ----
const STATUS_VARIANT: Record<IngestionStatus, 'green' | 'yellow' | 'red' | 'gray'> = {
  completed: 'green',
  processing: 'yellow',
  pending: 'gray',
  failed: 'red',
}

function ingestionVariant(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  return STATUS_VARIANT[status as IngestionStatus] ?? 'gray'
}

const CHUNK_STRATEGIES = ['fixed', 'sentence', 'paragraph', 'recursive']

// ---- Create Datasource Modal ----
function CreateDatasourceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (ds: DatasourceResponse) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() { setName(''); setDescription(''); setError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    try {
      const ds = await datasourcesApi.create({ name: name.trim(), description: description.trim() || null })
      onCreated(ds)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create datasource')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="New Datasource">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="Product Knowledge Base"
          value={name}
          onChange={e => setName(e.target.value)}
          error={error && !name.trim() ? error : undefined}
          autoFocus
        />
        <Textarea
          label="Description (optional)"
          placeholder="What kind of documents live here?"
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        {error && name.trim() && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={loading}>Create</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Edit Datasource Modal ----
function EditDatasourceModal({
  datasource,
  onClose,
  onUpdated,
}: {
  datasource: DatasourceResponse
  onClose: () => void
  onUpdated: (ds: DatasourceResponse) => void
}) {
  const [name, setName] = useState(datasource.name)
  const [description, setDescription] = useState(datasource.description ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    try {
      const updated = await datasourcesApi.update(datasource.id, {
        name: name.trim(),
        description: description.trim() || null,
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Datasource">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          error={error && !name.trim() ? error : undefined}
          autoFocus
        />
        <Textarea
          label="Description (optional)"
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        {error && name.trim() && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Upload Document Modal ----
function UploadDocumentModal({
  open,
  datasourceId,
  onClose,
  onUploaded,
}: {
  open: boolean
  datasourceId: string
  onClose: () => void
  onUploaded: (doc: DocumentResponse) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState('')
  const [metaError, setMetaError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setMetadata('')
    setMetaError('')
    setError('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please select a file'); return }
    if (metadata.trim()) {
      try { JSON.parse(metadata) } catch { setMetaError('Invalid JSON'); return }
    }
    setMetaError('')
    setLoading(true)
    try {
      const doc = await documentsApi.upload(datasourceId, file, metadata.trim() || undefined)
      onUploaded(doc)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Upload Document">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) setFile(f)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            file
              ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/10'
              : 'border-gray-300 hover:border-brand-400 dark:border-gray-600 dark:hover:border-brand-500',
          )}
        >
          <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
          {file ? (
            <>
              <FileText size={28} className="text-brand-600 dark:text-brand-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = '' }}
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <Upload size={28} className="text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Drag & drop a file here, or <span className="text-brand-600 dark:text-brand-400">browse</span>
              </p>
              <p className="text-xs text-gray-400">PDF, DOCX, TXT, MD, CSV…</p>
            </>
          )}
        </div>

        <Textarea
          label="Metadata JSON (optional)"
          placeholder='{ "source": "manual", "category": "docs" }'
          rows={2}
          value={metadata}
          onChange={e => setMetadata(e.target.value)}
          error={metaError}
          className="font-mono text-xs"
        />

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!file}>
            <Upload size={14} /> Upload
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Trigger Ingestion Modal ----
function TriggerIngestionModal({
  open,
  documentId,
  onClose,
  onCreated,
}: {
  open: boolean
  documentId: string
  onClose: () => void
  onCreated: (ing: IngestionResponse) => void
}) {
  const [form, setForm] = useState<CreateIngestionRequest>({
    chunk_strategy: 'recursive',
    chunk_config: { chunk_size: 512, chunk_overlap: 64 },
    embedding_model: '',
  })
  const [chunkConfigStr, setChunkConfigStr] = useState(
    JSON.stringify({ chunk_size: 512, chunk_overlap: 64 }, null, 2),
  )
  const [chunkConfigError, setChunkConfigError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setForm({ chunk_strategy: 'recursive', chunk_config: { chunk_size: 512, chunk_overlap: 64 }, embedding_model: '' })
    setChunkConfigStr(JSON.stringify({ chunk_size: 512, chunk_overlap: 64 }, null, 2))
    setChunkConfigError('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.embedding_model.trim()) { setError('Embedding model is required'); return }
    let chunk_config: Record<string, unknown>
    try {
      chunk_config = JSON.parse(chunkConfigStr) as Record<string, unknown>
    } catch {
      setChunkConfigError('Invalid JSON')
      return
    }
    setChunkConfigError('')
    setLoading(true)
    try {
      const ing = await ingestionsApi.create(documentId, { ...form, chunk_config })
      onCreated(ing)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ingestion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Trigger Ingestion" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chunk Strategy</label>
          <select
            value={form.chunk_strategy}
            onChange={e => setForm(f => ({ ...f, chunk_strategy: e.target.value }))}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-[#1e2535] dark:text-gray-100"
          >
            {CHUNK_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <Textarea
          label="Chunk Config (JSON)"
          rows={3}
          value={chunkConfigStr}
          onChange={e => setChunkConfigStr(e.target.value)}
          error={chunkConfigError}
          className="font-mono text-xs"
        />

        <Input
          label="Embedding Model"
          placeholder="e.g. text-embedding-3-small or model name from AIHub"
          value={form.embedding_model}
          onChange={e => setForm(f => ({ ...f, embedding_model: e.target.value }))}
          error={error && !form.embedding_model.trim() ? error : undefined}
          autoFocus
        />

        {error && form.embedding_model.trim() && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={loading}>
            <Play size={13} /> Run Ingestion
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Ingestion Row (inside document expansion) ----
function IngestionRow({ ingestion }: { ingestion: IngestionResponse }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant={ingestionVariant(ingestion.status)} className="shrink-0">
          {ingestion.status}
        </Badge>
        <span className="truncate font-mono text-gray-600 dark:text-gray-400">
          {ingestion.chunk_strategy}
        </span>
        <span className="shrink-0 text-gray-400">·</span>
        <span className="truncate text-gray-500 dark:text-gray-400">{ingestion.embedding_model}</span>
      </div>
      <span className="shrink-0 text-gray-400">{new Date(ingestion.created_at).toLocaleDateString()}</span>
    </div>
  )
}

// ---- Document Row ----
function DocumentRow({
  doc,
  onDelete,
  onIngest,
}: {
  doc: DocumentResponse
  onDelete: (doc: DocumentResponse) => void
  onIngest: (doc: DocumentResponse) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [ingestions, setIngestions] = useState<IngestionResponse[]>([])
  const [loadingIng, setLoadingIng] = useState(false)
  const [ingError, setIngError] = useState('')

  async function toggleExpand() {
    if (!expanded && ingestions.length === 0) {
      setLoadingIng(true)
      setIngError('')
      try {
        const data = await ingestionsApi.list(doc.id)
        setIngestions(data)
      } catch (err) {
        setIngError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoadingIng(false)
      }
    }
    setExpanded(v => !v)
  }

  function addIngestion(ing: IngestionResponse) {
    setIngestions(prev => [ing, ...prev])
    setExpanded(true)
  }

  const ext = doc.name.split('.').pop()?.toLowerCase() ?? ''

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark">
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={toggleExpand}
          className="flex shrink-0 items-center justify-center rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Toggle ingestions"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
          <FileText size={15} className="text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{doc.name}</p>
          <p className="truncate text-xs text-gray-400">{doc.storage_path}</p>
        </div>

        <Badge variant="gray" className="shrink-0 text-[10px] uppercase">{ext || 'file'}</Badge>
        <span className="shrink-0 text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onIngest(doc)}
            className="rounded p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
            title="Trigger ingestion"
          >
            <Play size={13} />
          </button>
          <button
            onClick={() => onDelete(doc)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            title="Delete document"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Ingestions panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ingestion runs</span>
            <button
              onClick={() => onIngest({ ...doc, _addIngestion: addIngestion } as unknown as DocumentResponse)}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
            >
              <Play size={11} /> New run
            </button>
          </div>
          {loadingIng ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />)}
            </div>
          ) : ingError ? (
            <p className="text-xs text-red-500">{ingError}</p>
          ) : ingestions.length === 0 ? (
            <p className="text-xs text-gray-400">No ingestion runs yet. Click the play button to start one.</p>
          ) : (
            <div className="space-y-1.5">
              {ingestions
                .slice()
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(ing => <IngestionRow key={ing.id} ingestion={ing} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Documents Panel ----
function DocumentsPanel({
  datasource,
}: {
  datasource: DatasourceResponse
}) {
  const [docs, setDocs] = useState<DocumentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<DocumentResponse | null>(null)
  const [ingestingDoc, setIngestingDoc] = useState<DocumentResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await documentsApi.list(datasource.id)
      setDocs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [datasource.id])

  useEffect(() => { void load() }, [load])

  async function confirmDeleteDoc() {
    if (!deletingDoc) return
    await documentsApi.delete(deletingDoc.id)
    setDocs(prev => prev.filter(d => d.id !== deletingDoc.id))
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{datasource.name}</h2>
          {datasource.description && (
            <p className="text-xs text-gray-400">{datasource.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload size={13} /> Upload
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && docs.length > 0 && (
        <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload a file to start building this datasource"
            action={
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <Upload size={13} /> Upload document
              </Button>
            }
          />
        ) : (
          docs
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(doc => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={setDeletingDoc}
                onIngest={d => setIngestingDoc(d)}
              />
            ))
        )}
      </div>

      <UploadDocumentModal
        open={showUpload}
        datasourceId={datasource.id}
        onClose={() => setShowUpload(false)}
        onUploaded={doc => setDocs(prev => [doc, ...prev])}
      />

      <DeleteConfirmModal
        open={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        itemName={deletingDoc?.name ?? ''}
        entityType="document"
        onConfirm={confirmDeleteDoc}
      />

      {ingestingDoc && (
        <TriggerIngestionModal
          open
          documentId={ingestingDoc.id}
          onClose={() => setIngestingDoc(null)}
          onCreated={() => setIngestingDoc(null)}
        />
      )}
    </div>
  )
}

// ---- Datasource Card (left panel) ----
function DatasourceCard({
  ds,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  ds: DatasourceResponse
  selected: boolean
  onSelect: () => void
  onEdit: (ds: DatasourceResponse) => void
  onDelete: (ds: DatasourceResponse) => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group w-full rounded-xl border px-4 py-3 text-left transition-all',
        selected
          ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/20'
          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50 dark:border-border-dark dark:bg-card-dark dark:hover:border-brand-600',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            selected ? 'bg-brand-100 dark:bg-brand-800/40' : 'bg-gray-100 dark:bg-gray-700',
          )}>
            <Database size={13} className={selected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'} />
          </div>
          <span className={cn('truncate text-sm font-medium', selected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-200')}>
            {ds.name}
          </span>
        </div>
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button
            onClick={e => { e.stopPropagation(); onEdit(ds) }}
            className="rounded p-1 text-gray-400 hover:bg-white hover:text-brand-600 dark:hover:bg-gray-700 dark:hover:text-brand-400"
            aria-label="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(ds) }}
            className="rounded p-1 text-gray-400 hover:bg-white hover:text-red-500 dark:hover:bg-gray-700"
            aria-label="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {ds.description && (
        <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">{ds.description}</p>
      )}
      <p className="mt-1.5 text-[10px] text-gray-400">
        Created {new Date(ds.created_at).toLocaleDateString()}
      </p>
    </button>
  )
}

// ---- Main page ----
export function DatasourcePage() {
  const [datasources, setDatasources] = useState<DatasourceResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<DatasourceResponse | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingDs, setEditingDs] = useState<DatasourceResponse | null>(null)
  const [deletingDs, setDeletingDs] = useState<DatasourceResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await datasourcesApi.list()
      setDatasources(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasources')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function confirmDeleteDs() {
    if (!deletingDs) return
    await datasourcesApi.delete(deletingDs.id)
    setDatasources(prev => prev.filter(d => d.id !== deletingDs.id))
    if (selected?.id === deletingDs.id) setSelected(null)
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-5 overflow-hidden">
      {/* ---- Left panel: Datasource list ---- */}
      <div className="flex w-72 shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Datasources</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))
          ) : datasources.length === 0 ? (
            <div className="mt-8 text-center">
              <Database size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400">No datasources yet</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
              >
                Create one
              </button>
            </div>
          ) : (
            datasources
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(ds => (
                <DatasourceCard
                  key={ds.id}
                  ds={ds}
                  selected={selected?.id === ds.id}
                  onSelect={() => setSelected(ds)}
                  onEdit={setEditingDs}
                  onDelete={setDeletingDs}
                />
              ))
          )}
        </div>
      </div>

      {/* ---- Divider ---- */}
      <div className="w-px shrink-0 bg-gray-200 dark:bg-border-dark" />

      {/* ---- Right panel: Documents ---- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selected ? (
          <DocumentsPanel key={selected.id} datasource={selected} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Database size={40} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                Select a datasource to view documents
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ---- Modals ---- */}
      <CreateDatasourceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={ds => {
          setDatasources(prev => [ds, ...prev])
          setSelected(ds)
        }}
      />

      {editingDs && (
        <EditDatasourceModal
          datasource={editingDs}
          onClose={() => setEditingDs(null)}
          onUpdated={updated => {
            setDatasources(prev => prev.map(d => d.id === updated.id ? updated : d))
            if (selected?.id === updated.id) setSelected(updated)
            setEditingDs(null)
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deletingDs}
        onClose={() => setDeletingDs(null)}
        itemName={deletingDs?.name ?? ''}
        entityType="datasource"
        onConfirm={confirmDeleteDs}
      />
    </div>
  )
}
