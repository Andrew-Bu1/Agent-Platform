import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Eye, FileText, Plus, Trash2, Wrench, X, Zap } from 'lucide-react'
import { agentsApi, promptsApi } from '@/lib/api/studio'
import type { AgentResponse, CreatePromptVersionRequest, PromptVersionResponse } from '@/lib/api/studio-types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

// ---- Context variable definitions for the time injection panel ----
const TIME_VARIABLES: { tag: string; label: string; example: string }[] = [
  { tag: '{{current_datetime}}', label: 'Current date & time', example: 'April 16, 2026 14:32:00 UTC' },
  { tag: '{{current_date}}', label: 'Current date', example: 'April 16, 2026' },
  { tag: '{{current_time}}', label: 'Current time', example: '14:32:00' },
  { tag: '{{current_day}}', label: 'Day of week', example: 'Thursday' },
  { tag: '{{current_month}}', label: 'Month name', example: 'April' },
  { tag: '{{current_year}}', label: 'Year', example: '2026' },
  { tag: '{{current_unix_ts}}', label: 'Unix timestamp', example: '1745332320' },
  { tag: '{{current_iso8601}}', label: 'ISO 8601', example: '2026-04-16T14:32:00Z' },
]

// ---- Prompt Detail Panel (slide-over) ----
function PromptDetailPanel({
  prompt,
  onClose,
}: {
  prompt: PromptVersionResponse
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Parse contextConfig for time and tool schemas
  const ctx = prompt.contextConfig ?? {}
  const injectTime = Boolean(ctx.injectTime ?? ctx.inject_time ?? ctx.time)
  const enabledVars: string[] = Array.isArray(ctx.timeVariables)
    ? (ctx.timeVariables as string[])
    : Array.isArray(ctx.time_variables)
      ? (ctx.time_variables as string[])
      : injectTime
        ? TIME_VARIABLES.map(v => v.tag)
        : []

  const rawTools = ctx.tools
  const toolSchemas: { name: string; description?: string; inputSchema?: Record<string, unknown>; outputSchema?: Record<string, unknown> }[] =
    Array.isArray(rawTools) ? (rawTools as typeof toolSchemas) : []

  const hasContext = injectTime || enabledVars.length > 0 || toolSchemas.length > 0 || Object.keys(ctx).length > 0

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative z-50 flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#151c2c]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
              <FileText size={15} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  Prompt v{prompt.version}
                </span>
                {prompt.isActive && <Badge variant="green">Active</Badge>}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(prompt.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* System Prompt */}
          <section className="border-b border-gray-100 px-6 py-5 dark:border-border-dark">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              System Prompt
            </h3>
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800 dark:bg-[#1e2535] dark:text-gray-200">
              {prompt.systemPrompt || <span className="italic text-gray-400">Empty</span>}
            </pre>
          </section>

          {/* Context Config */}
          <section className="border-b border-gray-100 px-6 py-5 dark:border-border-dark">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Context Configuration
            </h3>

            {!hasContext ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No context config set</p>
            ) : (
              <div className="space-y-5">
                {/* Time injection */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <Clock size={13} />
                    Time Injection Variables
                  </div>
                  {enabledVars.length === 0 ? (
                    <p className="text-xs text-gray-400 italic dark:text-gray-500">Not enabled</p>
                  ) : (
                    <div className="space-y-1.5">
                      {TIME_VARIABLES.filter(v => enabledVars.includes(v.tag)).map(v => (
                        <div
                          key={v.tag}
                          className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-border-dark dark:bg-[#1e2535]"
                        >
                          <div>
                            <code className="text-xs font-mono text-brand-600 dark:text-brand-400">{v.tag}</code>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">— {v.label}</span>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{v.example}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tool schemas */}
                {toolSchemas.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                      <Wrench size={13} />
                      Tool Schemas (OpenAI function calling format)
                    </div>
                    <div className="space-y-3">
                      {toolSchemas.map((t, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-border-dark dark:bg-[#1e2535]"
                        >
                          <p className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-200">{t.name}</p>
                          {t.description && (
                            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{t.description}</p>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Input Schema
                              </p>
                              <pre className="overflow-auto rounded-lg bg-white p-2.5 font-mono text-[10px] leading-relaxed text-gray-700 shadow-sm dark:bg-[#151c2c] dark:text-gray-300">
                                {t.inputSchema
                                  ? JSON.stringify(t.inputSchema, null, 2)
                                  : <span className="italic text-gray-400">—</span>}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Output Schema
                              </p>
                              <pre className="overflow-auto rounded-lg bg-white p-2.5 font-mono text-[10px] leading-relaxed text-gray-700 shadow-sm dark:bg-[#151c2c] dark:text-gray-300">
                                {t.outputSchema
                                  ? JSON.stringify(t.outputSchema, null, 2)
                                  : <span className="italic text-gray-400">—</span>}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw fallback for unknown keys */}
                {Object.keys(ctx).some(k => !['injectTime', 'inject_time', 'time', 'timeVariables', 'time_variables', 'tools'].includes(k)) && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Other Config</p>
                    <pre className="overflow-auto rounded-xl bg-gray-50 p-3 font-mono text-[10px] text-gray-700 dark:bg-[#1e2535] dark:text-gray-300">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(ctx).filter(([k]) =>
                            !['injectTime', 'inject_time', 'time', 'timeVariables', 'time_variables', 'tools'].includes(k)
                          )
                        ),
                        null, 2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Available time variables reference */}
          <section className="px-6 py-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Available Time Variables Reference
            </h3>
            <div className="space-y-1">
              {TIME_VARIABLES.map(v => (
                <div
                  key={v.tag}
                  className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <code className="font-mono text-brand-600 dark:text-brand-400">{v.tag}</code>
                  <span className="text-gray-500 dark:text-gray-400">{v.label}</span>
                  <span className="text-gray-400 dark:text-gray-500">{v.example}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function PromptCard({
  prompt,
  onDelete,
  onActivate,
  onView,
}: {
  prompt: PromptVersionResponse
  onDelete: (id: string) => void
  onActivate: (id: string) => void
  onView: (prompt: PromptVersionResponse) => void
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-border-dark dark:bg-card-dark">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            v{prompt.version}
          </span>
          {prompt.isActive && <Badge variant="green">Active</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(prompt)}
            title="View details"
            className="rounded p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
          >
            <Eye size={14} />
          </button>
          {!prompt.isActive && (
            <button
              onClick={() => onActivate(prompt.id)}
              title="Set as active"
              className="rounded p-1 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400"
            >
              <Zap size={14} />
            </button>
          )}
          <button
            onClick={() => onDelete(prompt.id)}
            className="hidden rounded p-1 text-gray-400 hover:text-red-500 group-hover:block dark:hover:text-red-400"
            aria-label="Delete prompt"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <pre className="line-clamp-4 cursor-pointer whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        onClick={() => onView(prompt)}
      >
        {prompt.systemPrompt}
      </pre>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        {new Date(prompt.createdAt).toLocaleDateString()}
      </p>
    </div>
  )
}

function CreatePromptModal({
  open,
  onClose,
  agentId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  agentId: string
  onCreated: (p: PromptVersionResponse) => void
}) {
  const [form, setForm] = useState<CreatePromptVersionRequest>({ systemPrompt: '', activate: true })
  const [contextStr, setContextStr] = useState('')
  const [contextError, setContextError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setForm({ systemPrompt: '', activate: true })
    setContextStr('')
    setContextError('')
    setError('')
  }

  function insertTag(tag: string) {
    setForm(f => ({ ...f, systemPrompt: f.systemPrompt + tag }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.systemPrompt.trim()) { setError('System prompt is required'); return }

    let contextConfig: Record<string, unknown> | undefined
    if (contextStr.trim()) {
      try {
        contextConfig = JSON.parse(contextStr) as Record<string, unknown>
        setContextError('')
      } catch {
        setContextError('Invalid JSON in context config')
        return
      }
    }

    setLoading(true)
    try {
      const res = await promptsApi.create(agentId, { ...form, contextConfig })
      if (res.data) { onCreated(res.data); reset(); onClose() }
    } catch {
      setError('Failed to create prompt version.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="New Prompt Version" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          label="System Prompt"
          placeholder="You are a helpful assistant that…"
          rows={7}
          value={form.systemPrompt}
          onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
          error={error && !form.systemPrompt.trim() ? error : undefined}
          autoFocus
          className="font-mono text-xs"
        />

        {/* Quick-insert time tags */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            Insert time variable into prompt:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TIME_VARIABLES.map(v => (
              <button
                key={v.tag}
                type="button"
                onClick={() => insertTag(v.tag)}
                className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] text-brand-600 hover:bg-brand-50 dark:border-border-dark dark:bg-[#1e2535] dark:text-brand-400 dark:hover:bg-brand-900/20"
              >
                {v.tag}
              </button>
            ))}
          </div>
        </div>

        {/* Context Config JSON */}
        <Textarea
          label="Context Config (optional JSON)"
          placeholder={'{\n  "injectTime": true,\n  "timeVariables": ["{{current_datetime}}", "{{current_date}}"],\n  "tools": []\n}'}
          rows={5}
          value={contextStr}
          onChange={e => setContextStr(e.target.value)}
          error={contextError}
          className="font-mono text-xs"
        />

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={form.activate ?? false}
            onChange={e => setForm(f => ({ ...f, activate: e.target.checked }))}
            className="rounded accent-brand-600"
          />
          Set as active version
        </label>
        {error && form.systemPrompt.trim() && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Version</Button>
        </div>
      </form>
    </Modal>
  )
}

export function PromptsPage() {
  const [agents, setAgents] = useState<AgentResponse[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [prompts, setPrompts] = useState<PromptVersionResponse[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [viewingPrompt, setViewingPrompt] = useState<PromptVersionResponse | null>(null)
  const [deletingPrompt, setDeletingPrompt] = useState<PromptVersionResponse | null>(null)

  // Load agents for the selector
  useEffect(() => {
    agentsApi.list(undefined, 0, 100).then(res => {
      if (res.data) {
        setAgents(res.data.content)
        if (res.data.content.length > 0) setSelectedAgentId(res.data.content[0].id)
      }
    }).finally(() => setLoadingAgents(false))
  }, [])

  const loadPrompts = useCallback(async () => {
    if (!selectedAgentId) return
    setLoadingPrompts(true)
    try {
      const res = await promptsApi.list(selectedAgentId)
      if (res.data) setPrompts(res.data)
    } finally {
      setLoadingPrompts(false)
    }
  }, [selectedAgentId])

  useEffect(() => { void loadPrompts() }, [loadPrompts])

  function handleDelete(id: string) {
    const prompt = prompts.find(p => p.id === id)
    if (prompt) setDeletingPrompt(prompt)
  }

  async function confirmDelete() {
    if (!deletingPrompt) return
    await promptsApi.delete(selectedAgentId, deletingPrompt.id)
    setPrompts(prev => prev.filter(p => p.id !== deletingPrompt.id))
  }

  async function handleActivate(id: string) {
    await promptsApi.activate(selectedAgentId, id)
    void loadPrompts()
  }

  return (
    <div className="space-y-5">
      {/* Agent selector + action */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Agent</label>
          {loadingAgents ? (
            <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ) : agents.length === 0 ? (
            <span className="text-sm text-gray-400">No agents — create one first</span>
          ) : (
            <select
              value={selectedAgentId}
              onChange={e => setSelectedAgentId(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-100"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
        {selectedAgentId && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Version
          </Button>
        )}
      </div>

      {/* List */}
      {!selectedAgentId ? null : loadingPrompts ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No prompt versions yet"
          description="Create the first prompt version for this agent"
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> New Version
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {prompts
            .slice()
            .sort((a, b) => b.version - a.version)
            .map(p => (
              <PromptCard
                key={p.id}
                prompt={p}
                onDelete={handleDelete}
                onActivate={handleActivate}
                onView={setViewingPrompt}
              />
            ))}
        </div>
      )}

      {selectedAgentId && (
        <CreatePromptModal
          open={showCreate}
          agentId={selectedAgentId}
          onClose={() => setShowCreate(false)}
          onCreated={p => setPrompts(prev => [p, ...prev])}
        />
      )}

      {viewingPrompt && (
        <PromptDetailPanel
          prompt={viewingPrompt}
          onClose={() => setViewingPrompt(null)}
        />
      )}

      <DeleteConfirmModal
        open={!!deletingPrompt}
        onClose={() => setDeletingPrompt(null)}
        itemName={deletingPrompt ? `v${deletingPrompt.version}` : ''}
        entityType="prompt version"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
