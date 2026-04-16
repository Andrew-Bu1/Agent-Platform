import { useCallback, useEffect, useState } from 'react'
import {
  Brain,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Filter,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { modelConfigApi } from '@/lib/api/aihub'
import type { ModelConfig, ModelConfigCreate, ModelConfigUpdate } from '@/lib/api/aihub-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ApiError } from '@/lib/api/client'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

// ---- Known task types & providers ----
const TASK_TYPES = ['chat', 'embedding', 'rerank']
const PROVIDERS = ['openrouter']

function taskTypeBadge(t: string): 'blue' | 'green' | 'yellow' | 'gray' {
  const m: Record<string, 'blue' | 'green' | 'yellow' | 'gray'> = {
    chat: 'blue',
    embedding: 'green',
    rerank: 'yellow'
  }
  return m[t] ?? 'gray'
}

function fmt(cost: string | null): string {
  if (!cost) return '—'
  const n = parseFloat(cost)
  if (isNaN(n)) return cost
  // Display as "$/1M tokens"
  return `$${(n * 1_000_000).toFixed(4)}/1M`
}

// ---- Model Card ----
function ModelCard({
  model,
  onEdit,
  onDelete,
}: {
  model: ModelConfig
  onEdit: (m: ModelConfig) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border-dark dark:bg-card-dark">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
            <Brain size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{model.name}</p>
            <p className="text-xs capitalize text-gray-400 dark:text-gray-500">{model.provider}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={taskTypeBadge(model.task_type)}>{model.task_type}</Badge>
          <Badge variant={model.is_active ? 'green' : 'gray'}>
            {model.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Costs */}
      <div className="flex gap-4 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <DollarSign size={11} />
          <span className="font-medium text-gray-700 dark:text-gray-200">Input:</span>
          <span>{fmt(model.input_cost)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <DollarSign size={11} />
          <span className="font-medium text-gray-700 dark:text-gray-200">Output:</span>
          <span>{fmt(model.output_cost)}</span>
        </div>
      </div>

      {/* Endpoint */}
      {model.endpoint_url && (
        <a
          href={model.endpoint_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 truncate text-xs text-brand-600 hover:underline dark:text-brand-400"
        >
          <ExternalLink size={11} className="shrink-0" />
          {model.endpoint_url}
        </a>
      )}

      {/* Footer actions */}
      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-gray-400 dark:text-gray-500">
        <span>Updated {new Date(model.updated_at).toLocaleDateString()}</span>
        <div className="hidden items-center gap-1 group-hover:flex">
          <button
            onClick={() => onEdit(model)}
            className="rounded p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
            aria-label="Edit model"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(model.id)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            aria-label="Delete model"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Shared form fields ----
interface ModelForm {
  name: string
  task_type: string
  provider: string
  endpoint_url: string
  input_cost: string
  output_cost: string
  is_active: boolean
}

function emptyForm(): ModelForm {
  return {
    name: '',
    task_type: 'chat',
    provider: 'openai',
    endpoint_url: '',
    input_cost: '',
    output_cost: '',
    is_active: true,
  }
}

function ModelFormFields({
  form,
  setForm,
  errors,
}: {
  form: ModelForm
  setForm: React.Dispatch<React.SetStateAction<ModelForm>>
  errors: Partial<Record<keyof ModelForm, string>>
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Name"
          placeholder="gpt-4o"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          error={errors.name}
          autoFocus
        />
        {/* Provider: select + free input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
          <select
            value={PROVIDERS.includes(form.provider) ? form.provider : '__custom__'}
            onChange={e => {
              if (e.target.value !== '__custom__') setForm(f => ({ ...f, provider: e.target.value }))
            }}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-[#1e2535] dark:text-gray-100"
          >
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="__custom__">custom…</option>
          </select>
          {!PROVIDERS.includes(form.provider) && (
            <Input
              placeholder="my-provider"
              value={form.provider}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Task Type</label>
          <select
            value={form.task_type}
            onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-[#1e2535] dark:text-gray-100"
          >
            {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Input
          label="Endpoint URL (optional)"
          placeholder="https://api.openai.com/v1"
          value={form.endpoint_url}
          onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Input Cost <span className="text-gray-400 font-normal">($ per token)</span>
          </label>
          <Input
            type="number"
            step="any"
            placeholder="0.0000015"
            value={form.input_cost}
            onChange={e => setForm(f => ({ ...f, input_cost: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Output Cost <span className="text-gray-400 font-normal">($ per token)</span>
          </label>
          <Input
            type="number"
            step="any"
            placeholder="0.000006"
            value={form.output_cost}
            onChange={e => setForm(f => ({ ...f, output_cost: e.target.value }))}
          />
        </div>
      </div>
    </div>
  )
}

// ---- Create Modal ----
function CreateModelModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (m: ModelConfig) => void
}) {
  const [form, setForm] = useState<ModelForm>(emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof ModelForm, string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() { setForm(emptyForm()); setErrors({}); setSubmitError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: typeof errors = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.provider.trim()) newErrors.provider = 'Provider is required'
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }

    setLoading(true)
    try {
      const body: ModelConfigCreate = {
        name: form.name.trim(),
        task_type: form.task_type,
        provider: form.provider.trim(),
        endpoint_url: form.endpoint_url.trim() || null,
        input_cost: form.input_cost.trim() || null,
        output_cost: form.output_cost.trim() || null,
      }
      const created = await modelConfigApi.create(body)
      onCreated(created)
      reset()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to create model')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="New Model Config" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModelFormFields form={form} setForm={setForm} errors={errors} />
        {submitError && <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Model</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Edit Modal ----
function EditModelModal({
  model,
  onClose,
  onUpdated,
}: {
  model: ModelConfig
  onClose: () => void
  onUpdated: (m: ModelConfig) => void
}) {
  const [form, setForm] = useState<ModelForm>({
    name: model.name,
    task_type: model.task_type,
    provider: model.provider,
    endpoint_url: model.endpoint_url ?? '',
    input_cost: model.input_cost ?? '',
    output_cost: model.output_cost ?? '',
    is_active: model.is_active,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ModelForm, string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: typeof errors = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.provider.trim()) newErrors.provider = 'Provider is required'
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }

    setLoading(true)
    try {
      const body: ModelConfigUpdate = {
        name: form.name.trim(),
        task_type: form.task_type,
        provider: form.provider.trim(),
        endpoint_url: form.endpoint_url.trim() || null,
        input_cost: form.input_cost.trim() || null,
        output_cost: form.output_cost.trim() || null,
        is_active: form.is_active,
      }
      const updated = await modelConfigApi.update(model.id, body)
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to update model')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Model Config" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModelFormFields form={form} setForm={setForm} errors={errors} />

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="rounded accent-brand-600"
          />
          Active
        </label>

        {submitError && <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Main Page ----
export function ModelsPage() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTaskType, setFilterTaskType] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)
  const [deletingModel, setDeletingModel] = useState<ModelConfig | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await modelConfigApi.list({
        task_type: filterTaskType || undefined,
        provider: filterProvider || undefined,
      })
      setModels(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [filterTaskType, filterProvider])

  useEffect(() => { void load() }, [load])

  function handleDelete(id: string) {
    const model = models.find(m => m.id === id)
    if (model) setDeletingModel(model)
  }

  async function confirmDelete() {
    if (!deletingModel) return
    await modelConfigApi.delete(deletingModel.id)
    setModels(prev => prev.filter(m => m.id !== deletingModel.id))
  }

  // Derived stats
  const activeCount = models.filter(m => m.is_active).length
  const providers = [...new Set(models.map(m => m.provider))].sort()
  const taskTypes = [...new Set(models.map(m => m.task_type))].sort()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Provider filter */}
        <div className="relative">
          <select
            value={filterProvider}
            onChange={e => setFilterProvider(e.target.value)}
            className="h-9 appearance-none rounded-lg border border-gray-300 bg-white pl-8 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-200"
          >
            <option value="">All providers</option>
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <Filter size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Task type filter */}
        <div className="relative">
          <select
            value={filterTaskType}
            onChange={e => setFilterTaskType(e.target.value)}
            className="h-9 appearance-none rounded-lg border border-gray-300 bg-white pl-8 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-200"
          >
            <option value="">All task types</option>
            {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Filter size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 appearance-none rounded-lg border border-gray-300 bg-white pl-8 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-200"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Filter size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Model
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && models.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-border-dark dark:bg-card-dark">
            <p className="text-xs text-gray-400 dark:text-gray-500">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{models.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-border-dark dark:bg-card-dark">
            <p className="text-xs text-gray-400 dark:text-gray-500">Active</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-border-dark dark:bg-card-dark">
            <p className="text-xs text-gray-400 dark:text-gray-500">Providers</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{providers.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-border-dark dark:bg-card-dark">
            <p className="text-xs text-gray-400 dark:text-gray-500">Task Types</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{taskTypes.length}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : models.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No model configs yet"
          description="Add a model config to let agents call LLMs, embeddings, or rerankers"
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> New Model
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models
            .filter(m =>
              (filterStatus === 'active' ? m.is_active :
               filterStatus === 'inactive' ? !m.is_active : true)
            )
            .map(m => (
              <ModelCard key={m.id} model={m} onEdit={setEditingModel} onDelete={handleDelete} />
            ))}
        </div>
      )}

      <CreateModelModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={m => { setModels(prev => [m, ...prev]); setShowCreate(false) }}
      />

      {editingModel && (
        <EditModelModal
          model={editingModel}
          onClose={() => setEditingModel(null)}
          onUpdated={updated => {
            setModels(prev => prev.map(m => m.id === updated.id ? updated : m))
            setEditingModel(null)
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deletingModel}
        onClose={() => setDeletingModel(null)}
        itemName={deletingModel?.name ?? ''}
        entityType="model config"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
