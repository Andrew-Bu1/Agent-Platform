import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, Trash2, Zap } from 'lucide-react'
import { agentsApi, promptsApi } from '@/lib/api/studio'
import type { AgentResponse, CreatePromptVersionRequest, PromptVersionResponse } from '@/lib/api/studio-types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'

function PromptCard({
  prompt,
  onDelete,
  onActivate,
}: {
  prompt: PromptVersionResponse
  onDelete: (id: string) => void
  onActivate: (id: string) => void
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

      <p className="line-clamp-4 rounded-lg bg-gray-50 p-3 text-xs font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {prompt.systemPrompt}
      </p>

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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() { setForm({ systemPrompt: '', activate: true }); setError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.systemPrompt.trim()) { setError('System prompt is required'); return }
    setLoading(true)
    try {
      const res = await promptsApi.create(agentId, form)
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
          rows={8}
          value={form.systemPrompt}
          onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
          error={error && !form.systemPrompt.trim() ? error : undefined}
          autoFocus
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

  async function handleDelete(id: string) {
    if (!confirm('Delete this prompt version?')) return
    await promptsApi.delete(selectedAgentId, id)
    void loadPrompts()
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
    </div>
  )
}
