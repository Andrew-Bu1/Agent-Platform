import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Trash2, Wrench } from 'lucide-react'
import { toolsApi } from '@/lib/api/studio'
import type { CreateToolRequest, ToolResponse } from '@/lib/api/studio-types'
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
}: {
  tool: ToolResponse
  onDelete: (id: string) => void
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
        <button
          onClick={() => onDelete(tool.id)}
          className="hidden rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 group-hover:flex dark:hover:bg-red-900/20"
          aria-label="Delete tool"
        >
          <Trash2 size={14} />
        </button>
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

export function ToolsPage() {
  const [tools, setTools] = useState<ToolResponse[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

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

  async function handleDelete(id: string) {
    if (!confirm('Delete this tool?')) return
    await toolsApi.delete(id)
    void load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tools…"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-100"
          />
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Tool
        </Button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{total} tool{total !== 1 ? 's' : ''}</p>

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
          {tools.map(t => (
            <ToolCard key={t.id} tool={t} onDelete={handleDelete} />
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
    </div>
  )
}
