import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ChevronDown, Filter, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { agentsApi } from '@/lib/api/studio'
import type { AgentResponse } from '@/lib/api/studio-types'
import { cn } from '@/lib/cn'
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

// ---- Config form types -------------------------------------------------------

interface ModelConfigForm {
  model: string
  temperature: number
  maxTokens: number
  topP: number
  stream: boolean
}

interface MemoryConfigForm {
  enabled: boolean
  strategy: 'none' | 'buffer' | 'summary'
  windowSize: number
  maxSummaryTokens: number
  includeSystemPrompt: boolean
}

const DEFAULT_MODEL_CONFIG: ModelConfigForm = {
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  stream: false,
}

const DEFAULT_MEMORY_CONFIG: MemoryConfigForm = {
  enabled: false,
  strategy: 'buffer',
  windowSize: 10,
  maxSummaryTokens: 1000,
  includeSystemPrompt: true,
}

function parseModelConfig(raw: Record<string, unknown>): ModelConfigForm {
  return {
    model: typeof raw.model === 'string' ? raw.model : DEFAULT_MODEL_CONFIG.model,
    temperature: typeof raw.temperature === 'number' ? raw.temperature : DEFAULT_MODEL_CONFIG.temperature,
    maxTokens: typeof raw.max_tokens === 'number' ? raw.max_tokens : DEFAULT_MODEL_CONFIG.maxTokens,
    topP: typeof raw.top_p === 'number' ? raw.top_p : DEFAULT_MODEL_CONFIG.topP,
    stream: typeof raw.stream === 'boolean' ? raw.stream : DEFAULT_MODEL_CONFIG.stream,
  }
}

function parseMemoryConfig(raw: Record<string, unknown>): MemoryConfigForm {
  const s = raw.strategy as string
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_MEMORY_CONFIG.enabled,
    strategy: ['none', 'buffer', 'summary'].includes(s) ? (s as MemoryConfigForm['strategy']) : DEFAULT_MEMORY_CONFIG.strategy,
    windowSize: typeof raw.window_size === 'number' ? raw.window_size : DEFAULT_MEMORY_CONFIG.windowSize,
    maxSummaryTokens: typeof raw.max_summary_tokens === 'number' ? raw.max_summary_tokens : DEFAULT_MEMORY_CONFIG.maxSummaryTokens,
    includeSystemPrompt: typeof raw.include_system_prompt === 'boolean' ? raw.include_system_prompt : DEFAULT_MEMORY_CONFIG.includeSystemPrompt,
  }
}

function toModelConfig(f: ModelConfigForm): Record<string, unknown> {
  return { model: f.model || 'gpt-4o', temperature: f.temperature, max_tokens: f.maxTokens, top_p: f.topP, stream: f.stream }
}

function toMemoryConfig(f: MemoryConfigForm): Record<string, unknown> {
  if (!f.enabled) return { enabled: false }
  const cfg: Record<string, unknown> = { enabled: true, strategy: f.strategy, include_system_prompt: f.includeSystemPrompt }
  if (f.strategy === 'buffer') cfg.window_size = f.windowSize
  if (f.strategy === 'summary') cfg.max_summary_tokens = f.maxSummaryTokens
  return cfg
}

// ---- Shared tab bar ----------------------------------------------------------

const AGENT_TABS = ['Basic', 'Model Config', 'Memory'] as const
type AgentTab = typeof AGENT_TABS[number]

function AgentTabBar({ active, onChange }: { active: AgentTab; onChange: (t: AgentTab) => void }) {
  return (
    <div className="-mx-6 mb-4 flex border-b border-gray-200 px-6 dark:border-border-dark">
      {AGENT_TABS.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            active === t
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ---- Slider + number input ---------------------------------------------------

function SliderInput({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
          className="w-20 rounded border border-gray-200 bg-white px-2 py-0.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ---- Model Config panel ------------------------------------------------------

function ModelConfigPanel({ config, onChange }: { config: ModelConfigForm; onChange: (c: ModelConfigForm) => void }) {
  function set<K extends keyof ModelConfigForm>(key: K, v: ModelConfigForm[K]) {
    onChange({ ...config, [key]: v })
  }
  return (
    <div className="space-y-5">
      <Input
        label="Model"
        placeholder="gpt-4o"
        value={config.model}
        onChange={e => set('model', e.target.value)}
      />
      <SliderInput
        label="Temperature"
        value={config.temperature}
        min={0} max={2} step={0.1}
        onChange={v => set('temperature', v)}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max Tokens</label>
          <input
            type="number"
            value={config.maxTokens}
            min={256} max={128000} step={256}
            onChange={e => set('maxTokens', Number(e.target.value))}
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
          />
        </div>
        <SliderInput
          label="Top P"
          value={config.topP}
          min={0} max={1} step={0.05}
          onChange={v => set('topP', v)}
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={config.stream}
          onChange={e => set('stream', e.target.checked)}
          className="rounded accent-brand-600"
        />
        Stream responses
      </label>
    </div>
  )
}

// ---- Memory Config panel -----------------------------------------------------

function MemoryConfigPanel({ config, onChange }: { config: MemoryConfigForm; onChange: (c: MemoryConfigForm) => void }) {
  function set<K extends keyof MemoryConfigForm>(key: K, v: MemoryConfigForm[K]) {
    onChange({ ...config, [key]: v })
  }
  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => set('enabled', !config.enabled)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
            config.enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600',
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow transition-transform',
              config.enabled && 'translate-x-6',
            )}
          />
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable memory</span>
      </div>

      {config.enabled && (
        <>
          {/* Strategy selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Strategy</label>
            <div className="grid grid-cols-3 gap-2">
              {(['none', 'buffer', 'summary'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('strategy', s)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm capitalize transition-colors',
                    config.strategy === s
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-border-dark dark:text-gray-400',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {config.strategy === 'none' && 'No memory — each conversation starts completely fresh.'}
              {config.strategy === 'buffer' && 'Pass the last N turns of conversation verbatim as context.'}
              {config.strategy === 'summary' && 'Maintain a rolling LLM-generated summary of the conversation.'}
            </p>
          </div>

          {/* Buffer: window size */}
          {config.strategy === 'buffer' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Recent turns (window size)
              </label>
              <p className="text-xs text-gray-400">Number of most-recent Q&amp;A turns to include as context.</p>
              <input
                type="number"
                value={config.windowSize}
                min={1} max={100} step={1}
                onChange={e => set('windowSize', Number(e.target.value))}
                className="h-9 w-28 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
              />
            </div>
          )}

          {/* Summary: max tokens */}
          {config.strategy === 'summary' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max summary tokens</label>
              <p className="text-xs text-gray-400">Maximum token budget for the rolling summary.</p>
              <input
                type="number"
                value={config.maxSummaryTokens}
                min={100} max={4000} step={100}
                onChange={e => set('maxSummaryTokens', Number(e.target.value))}
                className="h-9 w-28 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
              />
            </div>
          )}

          {/* Include system prompt */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={config.includeSystemPrompt}
              onChange={e => set('includeSystemPrompt', e.target.checked)}
              className="rounded accent-brand-600"
            />
            Include system prompt in memory context
          </label>
        </>
      )}
    </div>
  )
}

// ---- Create Agent Modal ------------------------------------------------------

function CreateAgentModal({
  open, onClose, onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (agent: AgentResponse) => void
}) {
  const [tab, setTab] = useState<AgentTab>('Basic')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [modelConfig, setModelConfig] = useState<ModelConfigForm>(DEFAULT_MODEL_CONFIG)
  const [memoryConfig, setMemoryConfig] = useState<MemoryConfigForm>(DEFAULT_MEMORY_CONFIG)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setTab('Basic')
    setName('')
    setDescription('')
    setModelConfig(DEFAULT_MODEL_CONFIG)
    setMemoryConfig(DEFAULT_MEMORY_CONFIG)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); setTab('Basic'); return }
    setLoading(true)
    try {
      const res = await agentsApi.create({
        name,
        description: description || undefined,
        modelConfig: toModelConfig(modelConfig),
        memoryConfig: toMemoryConfig(memoryConfig),
      })
      if (res.data) { onCreated(res.data); reset(); onClose() }
    } catch {
      setError('Failed to create agent. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="New Agent" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AgentTabBar active={tab} onChange={setTab} />
        <div className="min-h-[18rem] overflow-y-auto">
          {tab === 'Basic' && (
            <div className="space-y-4">
              <Input
                label="Name"
                placeholder="Customer Support Agent"
                value={name}
                onChange={e => setName(e.target.value)}
                error={error && !name.trim() ? error : undefined}
                autoFocus
              />
              <Textarea
                label="Description"
                placeholder="What does this agent do?"
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          )}
          {tab === 'Model Config' && (
            <ModelConfigPanel config={modelConfig} onChange={setModelConfig} />
          )}
          {tab === 'Memory' && (
            <MemoryConfigPanel config={memoryConfig} onChange={setMemoryConfig} />
          )}
        </div>
        {error && name.trim() && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Agent</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Edit Agent Modal --------------------------------------------------------

function EditAgentModal({
  agent, onClose, onUpdated,
}: {
  agent: AgentResponse
  onClose: () => void
  onUpdated: (agent: AgentResponse) => void
}) {
  const [tab, setTab] = useState<AgentTab>('Basic')
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description ?? '')
  const [isActive, setIsActive] = useState(agent.isActive)
  const [modelConfig, setModelConfig] = useState<ModelConfigForm>(() => parseModelConfig(agent.modelConfig))
  const [memoryConfig, setMemoryConfig] = useState<MemoryConfigForm>(() => parseMemoryConfig(agent.memoryConfig))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); setTab('Basic'); return }
    setLoading(true)
    try {
      const res = await agentsApi.update(agent.id, {
        name,
        description: description || undefined,
        isActive,
        modelConfig: toModelConfig(modelConfig),
        memoryConfig: toMemoryConfig(memoryConfig),
      })
      if (res.data) { onUpdated(res.data); onClose() }
    } catch {
      setError('Failed to update agent.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Agent" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AgentTabBar active={tab} onChange={setTab} />
        <div className="min-h-[18rem] overflow-y-auto">
          {tab === 'Basic' && (
            <div className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                error={error && !name.trim() ? error : undefined}
                autoFocus
              />
              <Textarea
                label="Description"
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded accent-brand-600"
                />
                Active
              </label>
            </div>
          )}
          {tab === 'Model Config' && (
            <ModelConfigPanel config={modelConfig} onChange={setModelConfig} />
          )}
          {tab === 'Memory' && (
            <MemoryConfigPanel config={memoryConfig} onChange={setMemoryConfig} />
          )}
        </div>
        {error && name.trim() && (
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
