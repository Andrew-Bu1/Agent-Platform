import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ChevronDown, Filter, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { agentsApi } from '@/lib/api/studio'
import type { AgentResponse, CreateAgentRequest, UpdateAgentRequest } from '@/lib/api/studio-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

function AgentCard({
  agent,
  onDelete,
  onEdit,
}: {
  agent: AgentResponse
  onDelete: (id: string) => void
  onEdit: (agent: AgentResponse) => void
}) {
  const navigate = useNavigate()
  return (
    <div className="group relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border-dark dark:bg-card-dark">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
            <Bot size={16} className="text-brand-600 dark:text-brand-400" />
          </div>
          <button
            className="text-left text-sm font-semibold text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
            onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
          >
            {agent.name}
          </button>
        </div>
        <Badge variant={agent.isActive ? 'green' : 'gray'}>
          {agent.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {agent.description && (
        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{agent.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-gray-400 dark:text-gray-500">
        <span>Created {new Date(agent.createdAt).toLocaleDateString()}</span>
        <div className="hidden items-center gap-1 group-hover:flex">
          <button
            onClick={() => onEdit(agent)}
            className="rounded p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
            aria-label="Edit agent"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            aria-label="Delete agent"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateAgentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (agent: AgentResponse) => void
}) {
  const [form, setForm] = useState<CreateAgentRequest>({ name: '', description: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setForm({ name: '', description: '' })
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    try {
      const res = await agentsApi.create(form)
      if (res.data) { onCreated(res.data); reset(); onClose() }
    } catch {
      setError('Failed to create agent. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="New Agent">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="Customer Support Agent"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          error={error && !form.name.trim() ? error : undefined}
          autoFocus
        />
        <Textarea
          label="Description"
          placeholder="What does this agent do?"
          rows={3}
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
        {error && form.name.trim() && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Agent
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function EditAgentModal({
  agent,
  onClose,
  onUpdated,
}: {
  agent: AgentResponse
  onClose: () => void
  onUpdated: (agent: AgentResponse) => void
}) {
  const [form, setForm] = useState<UpdateAgentRequest>({
    name: agent.name,
    description: agent.description ?? '',
    isActive: agent.isActive,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) { setError('Name is required'); return }
    setLoading(true)
    try {
      const res = await agentsApi.update(agent.id, form)
      if (res.data) { onUpdated(res.data); onClose() }
    } catch {
      setError('Failed to update agent.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Agent">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name ?? ''}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          error={error && !form.name?.trim() ? error : undefined}
          autoFocus
        />
        <Textarea
          label="Description"
          rows={3}
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={form.isActive ?? true}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
            className="rounded accent-brand-600"
          />
          Active
        </label>
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

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentResponse[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentResponse | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<AgentResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await agentsApi.list(search || undefined, page)
      if (res.data) {
        setAgents(res.data.content)
        setTotal(res.data.totalElements)
      }
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { void load() }, [load])

  // debounce search
  useEffect(() => { setPage(0) }, [search])

  function handleDelete(id: string) {
    const agent = agents.find(a => a.id === id)
    if (agent) setDeletingAgent(agent)
  }

  async function confirmDelete() {
    if (!deletingAgent) return
    await agentsApi.delete(deletingAgent.id)
    setAgents(prev => prev.filter(a => a.id !== deletingAgent.id))
    setTotal(prev => prev - 1)
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-100"
          />
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
          <Plus size={15} /> New Agent
        </Button>
      </div>

      {/* Stats */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {(() => {
          const filtered = agents.filter(a =>
            statusFilter === 'active' ? a.isActive :
            statusFilter === 'inactive' ? !a.isActive : true
          )
          return `${filtered.length} of ${total} agent${total !== 1 ? 's' : ''}${statusFilter ? ` (${statusFilter})` : ''}`
        })()}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first agent to get started"
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> New Agent
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents
            .filter(a =>
              statusFilter === 'active' ? a.isActive :
              statusFilter === 'inactive' ? !a.isActive : true
            )
            .map(a => (
              <AgentCard key={a.id} agent={a} onDelete={handleDelete} onEdit={setEditingAgent} />
            ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-gray-500">Page {page + 1}</span>
          <Button variant="secondary" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <CreateAgentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(a) => setAgents(prev => [a, ...prev])}
      />

      {editingAgent && (
        <EditAgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onUpdated={(updated) => {
            setAgents(prev => prev.map(a => a.id === updated.id ? updated : a))
            setEditingAgent(null)
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deletingAgent}
        onClose={() => setDeletingAgent(null)}
        itemName={deletingAgent?.name ?? ''}
        entityType="agent"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
