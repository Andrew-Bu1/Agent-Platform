import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { useModels } from '../store/modelsStore'

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'llm', label: 'LLM', description: 'Large Language Models for text generation' },
  { key: 'embedding', label: 'Embedding', description: 'Vector embedding models for semantic search' },
  { key: 'rerank', label: 'Rerank', description: 'Reranking models to improve retrieval relevance' },
]

const PROVIDERS = {
  openai: { label: 'OpenAI', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', dot: 'bg-emerald-500' },
  anthropic: { label: 'Anthropic', color: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', dot: 'bg-orange-500' },
  deepseek: { label: 'DeepSeek', color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400', dot: 'bg-blue-500' },
  cohere: { label: 'Cohere', color: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400', dot: 'bg-violet-500' },
  google: { label: 'Google', color: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400', dot: 'bg-sky-500' },
  mistral: { label: 'Mistral', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400', dot: 'bg-yellow-500' },
  custom: { label: 'Custom', color: 'bg-gray-100 text-gray-700 dark:bg-white/8 dark:text-gray-300', dot: 'bg-gray-400' },
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'custom', label: 'Custom / Self-hosted' },
]

const DEFAULT_BY_TYPE = {
  llm: { type: 'llm', name: '', provider: 'openai', modelId: '', apiKey: '', baseUrl: '', contextWindow: 128000, maxTokens: 4096, temperature: 0.7, enabled: true },
  embedding: { type: 'embedding', name: '', provider: 'openai', modelId: '', apiKey: '', baseUrl: '', dimensions: 1536, enabled: true },
  rerank: { type: 'rerank', name: '', provider: 'cohere', modelId: '', apiKey: '', baseUrl: '', enabled: true },
}

// ── Provider badge ─────────────────────────────────────────────────────────────
function ProviderBadge({ provider }) {
  const p = PROVIDERS[provider] ?? PROVIDERS.custom
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${p.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  )
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
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

// ── Input helpers ──────────────────────────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
    />
  )
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
    >
      {children}
    </select>
  )
}

// ── Model Form Modal ───────────────────────────────────────────────────────────
function ModelFormModal({ activeTab, editModel, onClose, onSave }) {
  const isEdit = !!editModel
  const [form, setForm] = useState(editModel ?? DEFAULT_BY_TYPE[activeTab])
  const [showKey, setShowKey] = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.modelId.trim()) return
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isEdit ? 'Edit model' : `Add ${TABS.find((t) => t.key === activeTab)?.label} model`}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {TABS.find((t) => t.key === form.type)?.description}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="model-form" onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Name */}
          <Field label="Display name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. GPT-4o Production" required />
          </Field>

          {/* Provider */}
          <Field label="Provider">
            <Select value={form.provider} onChange={(e) => set('provider', e.target.value)}>
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>

          {/* Model ID */}
          <Field label="Model ID" hint="The exact model identifier from the provider (e.g. gpt-4o, claude-3-5-sonnet-20241022)">
            <Input value={form.modelId} onChange={(e) => set('modelId', e.target.value)} placeholder="e.g. gpt-4o" required />
          </Field>

          {/* API Key */}
          <Field label="API Key">
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => set('apiKey', e.target.value)}
                placeholder="sk-••••••••••••••••"
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={showKey
                    ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                </svg>
              </button>
            </div>
          </Field>

          {/* Base URL (for custom / self-hosted) */}
          <Field label="Base URL" hint="Leave empty to use the provider default endpoint">
            <Input value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://api.example.com/v1" />
          </Field>

          {/* Type-specific fields */}
          {form.type === 'llm' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Context window">
                <Input type="number" value={form.contextWindow} onChange={(e) => set('contextWindow', Number(e.target.value))} placeholder="128000" />
              </Field>
              <Field label="Max tokens">
                <Input type="number" value={form.maxTokens} onChange={(e) => set('maxTokens', Number(e.target.value))} placeholder="4096" />
              </Field>
              <Field label="Temperature">
                <Input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => set('temperature', Number(e.target.value))} placeholder="0.7" />
              </Field>
            </div>
          )}

          {form.type === 'embedding' && (
            <Field label="Dimensions" hint="Output vector size (e.g. 1536 for text-embedding-3-small)">
              <Input type="number" value={form.dimensions} onChange={(e) => set('dimensions', Number(e.target.value))} placeholder="1536" />
            </Field>
          )}

          {/* Enabled */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</p>
              <p className="text-xs text-gray-400">Make this model available across the platform</p>
            </div>
            <Toggle checked={form.enabled} onChange={() => set('enabled', !form.enabled)} />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/8 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
            Cancel
          </button>
          <button form="model-form" type="submit" className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
            {isEdit ? 'Save changes' : 'Add model'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
function DeleteModal({ model, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/8 p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/15 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Remove model</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Are you sure you want to remove <span className="font-medium text-gray-800 dark:text-gray-200">{model.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Model Card ─────────────────────────────────────────────────────────────────
function ModelCard({ model, onEdit, onDelete, onToggle }) {
  return (
    <div className={`bg-white dark:bg-[#13131a] border rounded-xl p-5 flex flex-col gap-4 transition-colors ${model.enabled ? 'border-gray-200 dark:border-white/8 hover:border-gray-300 dark:hover:border-white/15' : 'border-dashed border-gray-200 dark:border-white/5 opacity-60'}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{model.name}</h3>
            <ProviderBadge provider={model.provider} />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono truncate">{model.modelId}</p>
        </div>
        <Toggle checked={model.enabled} onChange={() => onToggle(model.id)} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {model.type === 'llm' && (
          <>
            <div className="bg-gray-50 dark:bg-white/4 rounded-lg px-3 py-2">
              <p className="text-gray-400 mb-0.5">Context</p>
              <p className="font-medium text-gray-700 dark:text-gray-300">{(model.contextWindow / 1000).toFixed(0)}K tokens</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/4 rounded-lg px-3 py-2">
              <p className="text-gray-400 mb-0.5">Max output</p>
              <p className="font-medium text-gray-700 dark:text-gray-300">{(model.maxTokens / 1000).toFixed(1)}K tokens</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/4 rounded-lg px-3 py-2 col-span-2">
              <p className="text-gray-400 mb-0.5">Temperature</p>
              <p className="font-medium text-gray-700 dark:text-gray-300">{model.temperature}</p>
            </div>
          </>
        )}
        {model.type === 'embedding' && (
          <div className="bg-gray-50 dark:bg-white/4 rounded-lg px-3 py-2 col-span-2">
            <p className="text-gray-400 mb-0.5">Dimensions</p>
            <p className="font-medium text-gray-700 dark:text-gray-300">{model.dimensions?.toLocaleString()}</p>
          </div>
        )}
        {model.type === 'rerank' && (
          <div className="bg-gray-50 dark:bg-white/4 rounded-lg px-3 py-2 col-span-2">
            <p className="text-gray-400 mb-0.5">Type</p>
            <p className="font-medium text-gray-700 dark:text-gray-300">Cross-encoder reranker</p>
          </div>
        )}
        {/* API Key */}
        <div className="bg-gray-50 dark:bg-white/4 rounded-lg px-3 py-2 col-span-2">
          <p className="text-gray-400 mb-0.5">API Key</p>
          <p className="font-medium text-gray-700 dark:text-gray-300 font-mono text-[11px]">
            {model.apiKey ? model.apiKey.slice(0, 8) + '••••••••' : '—'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-white/5">
        <button
          onClick={() => onEdit(model)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          onClick={() => onDelete(model)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Remove
        </button>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ type, onAdd }) {
  const tab = TABS.find((t) => t.key === type)
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.3 24.3 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1-.26 2.28-1.41 1.62l-1.407-.89M5 14.5l-1.402 1.402c-1 1 .26 2.28 1.41 1.62l1.407-.89" />
        </svg>
      </div>
      <p className="text-gray-900 dark:text-white font-semibold mb-1">No {tab?.label} models yet</p>
      <p className="text-gray-400 text-sm mb-5 max-w-xs">{tab?.description}. Add your first one to get started.</p>
      <button onClick={onAdd} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add {tab?.label} model
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ModelsPage() {
  const { models, add, update, remove, toggle } = useModels()
  const [activeTab, setActiveTab] = useState('llm')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editModel, setEditModel] = useState(null)
  const [deleteModel, setDeleteModel] = useState(null)

  const filtered = models.filter(
    (m) => m.type === activeTab && m.name.toLowerCase().includes(search.toLowerCase()),
  )

  const openAdd = () => { setEditModel(null); setShowForm(true) }
  const openEdit = (m) => { setEditModel(m); setShowForm(true) }
  const handleSave = (form) => (editModel ? update(form) : add(form))
  const handleDelete = () => { remove(deleteModel.id); setDeleteModel(null) }

  const counts = Object.fromEntries(TABS.map((t) => [t.key, models.filter((m) => m.type === t.key).length]))
  const enabledCounts = Object.fromEntries(TABS.map((t) => [t.key, models.filter((m) => m.type === t.key && m.enabled).length]))

  return (
    <AppLayout>
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-gray-200 dark:border-white/8 bg-white dark:bg-[#13131a]">
        <h1 className="text-gray-900 dark:text-white font-semibold text-lg">Models</h1>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search models..."
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
            Add model
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {TABS.map((t) => (
            <div
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`bg-white dark:bg-[#13131a] border rounded-xl px-5 py-4 cursor-pointer transition-all ${activeTab === t.key ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-200 dark:border-white/8 hover:border-gray-300 dark:hover:border-white/15'}`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t.label} Models</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{counts[t.key]}</p>
              <p className="text-xs text-gray-400 mt-1">{enabledCounts[t.key]} active</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-white/8">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {t.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-400'}`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {TABS.find((t) => t.key === activeTab)?.description}
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <EmptyState type={activeTab} onAdd={openAdd} />
          ) : (
            filtered.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                onEdit={openEdit}
                onDelete={setDeleteModel}
                onToggle={toggle}
              />
            ))
          )}
        </div>
      </main>

      {/* Add / Edit modal */}
      {showForm && (
        <ModelFormModal
          activeTab={activeTab}
          editModel={editModel}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirm */}
      {deleteModel && (
        <DeleteModal
          model={deleteModel}
          onClose={() => setDeleteModel(null)}
          onConfirm={handleDelete}
        />
      )}
    </AppLayout>
  )
}
