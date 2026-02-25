import { useState, useEffect, useRef } from 'react'
import AppLayout from '../components/AppLayout'
import { useAgents } from '../store/agentsStore'
import { useModels } from '../store/modelsStore'
import { useTools } from '../store/toolsStore'

// ── Shared helpers ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-white/15'}`}
    >
      <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
const COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500',
]

function AgentAvatar({ agent, size = 'md' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sz} rounded-xl ${agent.color} flex items-center justify-center font-bold text-white shrink-0`}>
      {agent.avatar || agent.name[0].toUpperCase()}
    </div>
  )
}

// ── Quick Create / Edit modal ─────────────────────────────────────────────────
const DEFAULT_AGENT = {
  name: '', description: '', avatar: '', color: 'bg-blue-500', enabled: true,
  systemPrompt: 'You are a helpful AI assistant.', userPromptContext: [], tools: [],
  llmConfig: { modelId: '', temperature: 0.7, maxTokens: 2048, topP: 1, streaming: true, presencePenalty: 0, frequencyPenalty: 0 },
}

function AgentFormModal({ editAgent, onClose, onSave }) {
  const [form, setForm] = useState(editAgent ?? DEFAULT_AGENT)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (!form.avatar.trim()) form.avatar = form.name[0].toUpperCase()
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {editAgent ? 'Edit agent' : 'New agent'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form id="agent-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="flex gap-3">
            {/* Avatar preview */}
            <div className={`w-14 h-14 rounded-xl ${form.color} flex items-center justify-center text-white font-bold text-xl shrink-0`}>
              {(form.avatar || form.name[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 space-y-2">
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Agent name"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
              <input
                value={form.avatar}
                onChange={(e) => set('avatar', e.target.value.slice(0, 2).toUpperCase())}
                placeholder="Avatar initials (1-2 chars)"
                maxLength={2}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-lg ${c} transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#13131a] scale-110' : 'hover:scale-110'}`}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What does this agent do?"
              rows={2}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/8 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
            Cancel
          </button>
          <button form="agent-form" type="submit" className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
            {editAgent ? 'Save changes' : 'Create agent'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────────
function DeleteModal({ agent, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/8 p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/15 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Delete agent</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Are you sure you want to delete <span className="font-medium text-gray-800 dark:text-gray-200">{agent.name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Agent Card ─────────────────────────────────────────────────────────────────
function AgentCard({ agent, onClick, onEdit, onDelete, onToggle }) {
  return (
    <div
      onClick={onClick}
      className={`group bg-white dark:bg-[#13131a] border rounded-xl p-5 flex flex-col gap-4 cursor-pointer transition-all ${agent.enabled ? 'border-gray-200 dark:border-white/8 hover:border-blue-300 dark:hover:border-blue-500/40 hover:shadow-md dark:hover:shadow-blue-500/5' : 'border-dashed border-gray-200 dark:border-white/5 opacity-55'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AgentAvatar agent={agent} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{agent.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${agent.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-400">{agent.enabled ? 'Active' : 'Disabled'}</span>
            </div>
          </div>
        </div>
        <Toggle checked={agent.enabled} onChange={(e) => { e.stopPropagation(); onToggle(agent.id) }} />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 flex-1">{agent.description}</p>

      {/* Footer meta */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 11-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
          {agent.tools.length} tools
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {agent.systemPrompt ? 'Prompt set' : 'No prompt'}
        </span>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 border-t border-gray-100 dark:border-white/5 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onEdit(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          onClick={() => onDelete(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Slider input ───────────────────────────────────────────────────────────────
function SliderField({ label, value, min, max, step, onChange, display }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">{label}</label>
        <span className="text-xs font-mono bg-gray-100 dark:bg-white/8 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
          {display ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-white/10 accent-blue-600 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ── Context injection options for the User Prompt ────────────────────────────
const USER_CONTEXT_OPTIONS = [
  { key: 'currentDate', label: 'Current date', variable: '{{currentDate}}', description: "Today's date (YYYY-MM-DD)" },
  { key: 'currentTime', label: 'Current time', variable: '{{currentTime}}', description: 'Current local time (HH:MM:SS)' },
]

// ── Detail Panel ───────────────────────────────────────────────────────────────
const PANEL_TABS = ['Prompt', 'LLM Config', 'Tools']

function AgentDetailPanel({ agent, onClose, onUpdate }) {
  const { models } = useModels()
  const llmModels = models.filter((m) => m.type === 'llm' && m.enabled)
  const { tools: allTools } = useTools()

  const [activeTab, setActiveTab] = useState('Prompt')
  const [prompt, setPrompt] = useState(agent.systemPrompt)
  const [userCtx, setUserCtx] = useState(agent.userPromptContext ?? [])
  const [llmConfig, setLlmConfig] = useState(agent.llmConfig)
  // assigned tool IDs – initialised from agent.tools (array of tool objects with .id)
  const [assignedIds, setAssignedIds] = useState(() => new Set((agent.tools ?? []).map((t) => t.id)))
  const [dirty, setDirty] = useState(false)
  const panelRef = useRef(null)

  const setLlm = (k, v) => { setLlmConfig((c) => ({ ...c, [k]: v })); setDirty(true) }

  const addContext = (key) => {
    if (userCtx.includes(key)) return
    setUserCtx((prev) => [...prev, key])
    setDirty(true)
  }
  const removeContext = (key) => {
    setUserCtx((prev) => prev.filter((k) => k !== key))
    setDirty(true)
  }

  const toggleTool = (id) => {
    setAssignedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setDirty(true)
  }

  const handleSave = () => {
    const tools = allTools.filter((t) => assignedIds.has(t.id))
    onUpdate({ ...agent, systemPrompt: prompt, userPromptContext: userCtx, llmConfig, tools })
    setDirty(false)
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedModel = llmModels.find((m) => m.id === llmConfig.modelId)

  return (
    <>
      {/* Backdrop (click outside to close) */}
      <div className="fixed inset-0 z-30 bg-black/20 dark:bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-[520px] flex flex-col bg-white dark:bg-[#13131a] border-l border-gray-200 dark:border-white/8 shadow-2xl"
      >
        {/* Panel header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-white/8 shrink-0">
          <AgentAvatar agent={agent} size="sm" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{agent.name}</h2>
            <p className="text-xs text-gray-400 truncate">{agent.description}</p>
          </div>
          {dirty && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200 dark:border-white/8 shrink-0 px-5">
          {PANEL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {tab}
              {tab === 'Tools' && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  assignedIds.size > 0
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-400'
                }`}>
                  {assignedIds.size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Prompt ── */}
          {activeTab === 'Prompt' && (
            <div className="p-5 space-y-6">

              {/* ── System Prompt ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">System prompt</p>
                    <p className="text-xs text-gray-400 mt-0.5">Defines the agent's personality, role, and behavior.</p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono shrink-0">{prompt.length} chars</span>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setDirty(true) }}
                  placeholder="You are a helpful AI assistant..."
                  rows={12}
                  className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none font-mono leading-relaxed"
                />
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/6" />

              {/* ── User Prompt ── */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">User prompt</p>
                  <p className="text-xs text-gray-400 mt-0.5">Context injected before every user message at runtime.</p>
                </div>

                {/* Context injection pills */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                    Prepend context
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {USER_CONTEXT_OPTIONS.map((opt) => {
                      const active = userCtx.includes(opt.key)
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => active ? removeContext(opt.key) : addContext(opt.key)}
                          title={opt.description}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            active
                              ? 'bg-violet-600 border-violet-600 text-white'
                              : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-violet-400 dark:hover:border-violet-500/50 hover:text-violet-600 dark:hover:text-violet-400'
                          }`}
                        >
                          {active ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Live preview */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                    Preview
                  </label>
                  <div className="rounded-xl border border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-[#0d0d14] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-[#13131a] border-b border-gray-200 dark:border-white/8">
                      <span className="text-[11px] text-gray-400 font-mono">User Prompt Template</span>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {userCtx.length} injection{userCtx.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-[12px] leading-relaxed font-mono whitespace-pre-wrap">
                      {userCtx.map((k) => {
                        const opt = USER_CONTEXT_OPTIONS.find((o) => o.key === k)
                        return opt
                          ? <span key={k} className="text-violet-500 dark:text-violet-400 block">{opt.variable}</span>
                          : null
                      })}
                      <span className="text-gray-400 dark:text-gray-500">{'<context>\n'}</span>
                      <span className="text-blue-500 dark:text-blue-400">{'{{userMessage}}'}</span>
                      <span className="text-gray-400 dark:text-gray-500">{'\n</context>'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-500/8 border border-violet-100 dark:border-violet-500/15 rounded-xl">
                  <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    Selected variables are resolved at runtime and prepended before <code className="bg-violet-100 dark:bg-violet-500/20 px-1 rounded font-mono">{'{{userMessage}}'}</code>.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ── LLM Config ── */}
          {activeTab === 'LLM Config' && (
            <div className="p-5 space-y-6">
              {/* Model selector */}
              <Field label="Model" hint={selectedModel ? `Context: ${(selectedModel.contextWindow / 1000).toFixed(0)}K tokens · Provider: ${selectedModel.provider}` : 'No enabled LLM models found — add one in the Models page.'}>
                <select
                  value={llmConfig.modelId}
                  onChange={(e) => setLlm('modelId', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                >
                  <option value="">— Select a model —</option>
                  {llmModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </Field>

              <div className="h-px bg-gray-100 dark:bg-white/6" />

              {/* Sliders */}
              <SliderField
                label="Temperature"
                value={llmConfig.temperature}
                min={0} max={2} step={0.05}
                onChange={(v) => setLlm('temperature', v)}
              />
              <SliderField
                label="Max output tokens"
                value={llmConfig.maxTokens}
                min={256} max={16384} step={256}
                onChange={(v) => setLlm('maxTokens', v)}
                display={llmConfig.maxTokens.toLocaleString()}
              />
              <SliderField
                label="Top P"
                value={llmConfig.topP}
                min={0} max={1} step={0.05}
                onChange={(v) => setLlm('topP', v)}
              />
              <SliderField
                label="Presence penalty"
                value={llmConfig.presencePenalty}
                min={-2} max={2} step={0.05}
                onChange={(v) => setLlm('presencePenalty', v)}
              />
              <SliderField
                label="Frequency penalty"
                value={llmConfig.frequencyPenalty}
                min={-2} max={2} step={0.05}
                onChange={(v) => setLlm('frequencyPenalty', v)}
              />

              <div className="h-px bg-gray-100 dark:bg-white/6" />

              {/* Streaming toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Streaming</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stream tokens as they are generated</p>
                </div>
                <Toggle checked={llmConfig.streaming} onChange={() => setLlm('streaming', !llmConfig.streaming)} />
              </div>
            </div>
          )}

          {/* ── Tools ── */}
          {activeTab === 'Tools' && (
            <div className="p-5 space-y-5">
              {/* Assigned section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Assigned ({assignedIds.size})</span>
                  {assignedIds.size > 0 && (
                    <button
                      onClick={() => { setAssignedIds(new Set()); setDirty(true) }}
                      className="text-xs text-red-400 hover:text-red-500 transition-colors"
                    >
                      Remove all
                    </button>
                  )}
                </div>

                {assignedIds.size === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    No tools assigned yet — select from the list below
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allTools.filter((t) => assignedIds.has(t.id)).map((t) => (
                      <div key={t.id} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-500/8 border border-blue-200 dark:border-blue-500/20 rounded-xl group">
                        <div className={`w-8 h-8 rounded-lg ${t.color} flex items-center justify-center text-base shrink-0`}>
                          {t.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            <span className={`inline-block mr-1.5 font-medium ${
                              t.type === 'api' ? 'text-blue-500' : 'text-violet-500'
                            }`}>{t.type === 'api' ? 'API' : 'Python'}</span>
                            {t.description}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleTool(t.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-red-500 transition-colors shrink-0"
                          title="Remove"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/6" />

              {/* Available tools */}
              <div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                  Available tools ({allTools.length})
                </span>

                {allTools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm text-gray-400">No tools exist yet.</p>
                    <p className="text-xs text-gray-400 mt-0.5">Build some in the <span className="text-blue-500">Tools</span> page first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allTools.map((t) => {
                      const assigned = assignedIds.has(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTool(t.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            assigned
                              ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50/50 dark:bg-blue-500/6 opacity-50 cursor-default'
                              : t.enabled
                              ? 'border-gray-200 dark:border-white/8 bg-white dark:bg-[#13131a] hover:border-blue-300 dark:hover:border-blue-500/30 hover:bg-blue-50/40 dark:hover:bg-blue-500/5'
                              : 'border-dashed border-gray-200 dark:border-white/5 bg-white dark:bg-[#13131a] opacity-40'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg ${t.color} flex items-center justify-center text-base shrink-0`}>
                            {t.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                              {!t.enabled && <span className="text-[10px] text-gray-400 border border-gray-200 dark:border-white/10 px-1.5 rounded-full">disabled</span>}
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              <span className={`inline-block mr-1.5 font-medium ${
                                t.type === 'api' ? 'text-blue-500' : 'text-violet-500'
                              }`}>{t.type === 'api' ? 'API' : 'Python'}</span>
                              {t.description}
                            </p>
                          </div>
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            assigned
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300 dark:border-white/20'
                          }`}>
                            {assigned && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Panel footer */}
        {dirty && (
          <div className="px-5 py-3.5 border-t border-gray-200 dark:border-white/8 flex items-center justify-between bg-blue-50/80 dark:bg-blue-500/8 shrink-0">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Unsaved changes</p>
            <div className="flex gap-2">
              <button onClick={() => { setPrompt(agent.systemPrompt); setUserCtx(agent.userPromptContext ?? []); setLlmConfig(agent.llmConfig); setAssignedIds(new Set((agent.tools ?? []).map((t) => t.id))); setDirty(false) }} className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-white/8 rounded-lg transition-colors">
                Discard
              </button>
              <button onClick={handleSave} className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const { agents, add, update, remove, toggle } = useAgents()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editAgent, setEditAgent] = useState(null)
  const [deleteAgent, setDeleteAgent] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase()),
  )

  const openAdd = () => { setEditAgent(null); setShowForm(true) }
  const openEdit = (a) => { setEditAgent(a); setShowForm(true) }
  const handleSave = (form) => (editAgent ? update(form) : add(form))
  const handleDelete = () => { remove(deleteAgent.id); setDeleteAgent(null); if (selectedAgent?.id === deleteAgent.id) setSelectedAgent(null) }
  const handleUpdate = (updated) => { update(updated); setSelectedAgent(updated) }

  const active = agents.filter((a) => a.enabled).length

  return (
    <AppLayout>
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-gray-200 dark:border-white/8 bg-white dark:bg-[#13131a]">
        <div className="flex items-center gap-3">
          <h1 className="text-gray-900 dark:text-white font-semibold text-lg">Agents</h1>
          <span className="text-xs bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full">
            {active} active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52 pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/8 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New agent
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Summary */}
        <div className="flex items-center gap-6 mb-6 text-sm text-gray-500 dark:text-gray-400">
          <span><span className="font-semibold text-gray-900 dark:text-white">{agents.length}</span> total agents</span>
          <span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{active}</span> active</span>
          <span><span className="font-semibold text-gray-500 dark:text-gray-400">{agents.length - active}</span> disabled</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-1">No agents found</p>
            <p className="text-gray-400 text-sm mb-5">Create your first agent to get started.</p>
            <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => setSelectedAgent(agent)}
                onEdit={openEdit}
                onDelete={setDeleteAgent}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail panel */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <AgentFormModal
          editAgent={editAgent}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirm */}
      {deleteAgent && (
        <DeleteModal
          agent={deleteAgent}
          onClose={() => setDeleteAgent(null)}
          onConfirm={handleDelete}
        />
      )}
    </AppLayout>
  )
}
