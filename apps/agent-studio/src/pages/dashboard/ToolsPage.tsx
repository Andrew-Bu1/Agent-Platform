import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Filter, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react'
import { toolsApi } from '@/lib/api/studio'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import type { CreateToolRequest, ToolResponse, UpdateToolRequest } from '@/lib/api/studio-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'

const TOOL_TYPES = ['api', 'function', 'retrieval', 'code_interpreter']

function ToolTypeColor(type: string): 'blue' | 'green' | 'yellow' | 'gray' {
  const map: Record<string, 'blue' | 'green' | 'yellow' | 'gray'> = {
    api: 'blue',
    function: 'green',
    retrieval: 'yellow',
    code_interpreter: 'gray',
  }
  return map[type] ?? 'gray'
}

function ToolCard({
  tool,
  onDelete,
  onEdit,
}: {
  tool: ToolResponse
  onDelete: (id: string) => void
  onEdit: (tool: ToolResponse) => void
}) {
  return (
    <div className="group relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border-dark dark:bg-card-dark">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
            <Wrench size={15} className="text-gray-500 dark:text-gray-400" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{tool.name}</span>
        </div>
        <Badge variant={ToolTypeColor(tool.type)}>{tool.type}</Badge>
      </div>

      {tool.description && (
        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-gray-400 dark:text-gray-500">
        <Badge variant={tool.isActive ? 'green' : 'gray'} className="text-[10px]">
          {tool.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <div className="hidden items-center gap-1 group-hover:flex">
          <button
            onClick={() => onEdit(tool)}
            className="rounded p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
            aria-label="Edit tool"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(tool.id)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            aria-label="Delete tool"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateToolModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (tool: ToolResponse) => void
}) {
  const [form, setForm] = useState<CreateToolRequest>({ name: '', type: 'api' })
  const [errors, setErrors] = useState<Partial<Record<keyof CreateToolRequest, string>>>({})
  const [loading, setLoading] = useState(false)
  const [generalError, setGeneralError] = useState('')

  function reset() {
    setForm({ name: '', type: 'api' })
    setErrors({})
    setGeneralError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: typeof errors = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.type.trim()) newErrors.type = 'Type is required'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setLoading(true)
    try {
      const res = await toolsApi.create(form)
      if (res.data) { onCreated(res.data); reset(); onClose() }
    } catch {
      setGeneralError('Failed to create tool. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="New Tool">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="Customer Lookup API"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          error={errors.name}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-[#1e2535] dark:text-gray-100"
          >
            {TOOL_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <Textarea
          label="Description"
          placeholder="What does this tool do?"
          rows={3}
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
        {generalError && <p className="text-xs text-red-600 dark:text-red-400">{generalError}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Tool</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Edit Tool Modal ----
function schemaToString(schema: Record<string, unknown> | undefined): string {
  if (!schema || Object.keys(schema).length === 0) return ''
  return JSON.stringify(schema, null, 2)
}

function parseSchema(raw: string): { value: Record<string, unknown> | undefined; error: string } {
  if (!raw.trim()) return { value: undefined, error: '' }
  try {
    return { value: JSON.parse(raw) as Record<string, unknown>, error: '' }
  } catch {
    return { value: undefined, error: 'Invalid JSON' }
  }
}

function EditToolModal({
  tool,
  onClose,
  onUpdated,
}: {
  tool: ToolResponse
  onClose: () => void
  onUpdated: (tool: ToolResponse) => void
}) {
  const [form, setForm] = useState<UpdateToolRequest>({
    name: tool.name,
    type: tool.type,
    description: tool.description ?? '',
    requireApproval: tool.requireApproval,
    isActive: tool.isActive,
  })
  const [inputSchemaStr, setInputSchemaStr] = useState(schemaToString(tool.inputSchema))
  const [outputSchemaStr, setOutputSchemaStr] = useState(schemaToString(tool.outputSchema))
  const [schemaErrors, setSchemaErrors] = useState({ input: '', output: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) { setError('Name is required'); return }

    const { value: inputSchema, error: inErr } = parseSchema(inputSchemaStr)
    const { value: outputSchema, error: outErr } = parseSchema(outputSchemaStr)
    if (inErr || outErr) {
      setSchemaErrors({ input: inErr, output: outErr })
      return
    }
    setSchemaErrors({ input: '', output: '' })

    setLoading(true)
    try {
      const res = await toolsApi.update(tool.id, { ...form, inputSchema, outputSchema })
      if (res.data) { onUpdated(res.data); onClose() }
    } catch {
      setError('Failed to update tool.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Tool" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Name"
            value={form.name ?? ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            error={error && !form.name?.trim() ? error : undefined}
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <select
              value={form.type ?? 'api'}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-[#1e2535] dark:text-gray-100"
            >
              {TOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <Textarea
          label="Description"
          rows={2}
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
        <Textarea
          label="Input Schema (OpenAI function calling format)"
          placeholder={'{ "type": "object", "properties": { "query": { "type": "string" } }, "required": ["query"] }'}
          rows={5}
          value={inputSchemaStr}
          onChange={e => setInputSchemaStr(e.target.value)}
          error={schemaErrors.input}
          className="font-mono text-xs"
        />
        <Textarea
          label="Output Schema"
          placeholder={'{ "type": "object", "properties": { "result": { "type": "string" } } }'}
          rows={5}
          value={outputSchemaStr}
          onChange={e => setOutputSchemaStr(e.target.value)}
          error={schemaErrors.output}
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={form.requireApproval ?? false}
              onChange={e => setForm(f => ({ ...f, requireApproval: e.target.checked }))}
              className="rounded accent-brand-600"
            />
            Requires approval
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="rounded accent-brand-600"
            />
            Active
          </label>
        </div>
        {error && form.name?.trim() && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

export function ToolsPage() {
  const [tools, setTools] = useState<ToolResponse[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTool, setEditingTool] = useState<ToolResponse | null>(null)
  const [deletingTool, setDeletingTool] = useState<ToolResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await toolsApi.list(search || undefined, page)
      if (res.data) {
        setTools(res.data.content)
        setTotal(res.data.totalElements)
      }
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(0) }, [search])

  function handleDelete(id: string) {
    const tool = tools.find(t => t.id === id)
    if (tool) setDeletingTool(tool)
  }

  async function confirmDelete() {
    if (!deletingTool) return
    await toolsApi.delete(deletingTool.id)
    setTools(prev => prev.filter(t => t.id !== deletingTool.id))
    setTotal(prev => prev - 1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tools…"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-100"
          />
        </div>

        {/* Tool type filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-9 appearance-none rounded-lg border border-gray-300 bg-white pl-8 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-200"
          >
            <option value="">All types</option>
            {TOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Filter size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 appearance-none rounded-lg border border-gray-300 bg-white pl-8 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-200"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Filter size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Tool
        </Button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        {(() => {
          const filtered = tools.filter(t =>
            (typeFilter ? t.type === typeFilter : true) &&
            (statusFilter === 'active' ? t.isActive :
             statusFilter === 'inactive' ? !t.isActive : true)
          )
          return `${filtered.length} of ${total} tool${total !== 1 ? 's' : ''}`
        })()}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No tools yet"
          description="Create a tool to connect your agents to external systems"
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> New Tool
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools
            .filter(t =>
              (typeFilter ? t.type === typeFilter : true) &&
              (statusFilter === 'active' ? t.isActive :
               statusFilter === 'inactive' ? !t.isActive : true)
            )
            .map(t => (
              <ToolCard key={t.id} tool={t} onDelete={handleDelete} onEdit={setEditingTool} />
            ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-gray-500">Page {page + 1}</span>
          <Button variant="secondary" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <CreateToolModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(t) => setTools(prev => [t, ...prev])}
      />

      {editingTool && (
        <EditToolModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onUpdated={(updated) => {
            setTools(prev => prev.map(t => t.id === updated.id ? updated : t))
            setEditingTool(null)
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deletingTool}
        onClose={() => setDeletingTool(null)}
        itemName={deletingTool?.name ?? ''}
        entityType="tool"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
