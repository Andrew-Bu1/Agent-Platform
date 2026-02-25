import { useState, useEffect, useRef } from 'react'
import AppLayout from '../components/AppLayout'
import { useTools } from '../store/toolsStore'

// ── Tiny shared pieces ─────────────────────────────────────────────────────────
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

function Badge({ label, variant = 'default' }) {
  const styles = {
    api:  'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20',
    code: 'bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-500/20',
    default: 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${styles[variant] ?? styles.default}`}>
      {label}
    </span>
  )
}

// ── Color + icon options ───────────────────────────────────────────────────────
const COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500',
]

const ICONS = ['🔍', '🌐', '📊', '⚡', '🔧', '📝', '📁', '🔗', '🛠️', '📡', '🤖', '🔐']

// ── Code editor with line numbers ──────────────────────────────────────────────
function CodeEditor({ value, onChange, language = 'python', readOnly = false }) {
  const lineCount = (value || '').split('\n').length
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-white/8 bg-[#0d0d14] overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-[#13131a]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-[11px] text-white/30 font-mono">{language}</span>
        <span className="text-[11px] text-white/30 font-mono">{lineCount} lines</span>
      </div>

      {/* Editor body */}
      <div className="flex overflow-auto" style={{ minHeight: 320, maxHeight: 520 }}>
        {/* Line numbers */}
        <div className="select-none py-3 px-3 text-right text-[12px] leading-6 font-mono text-white/20 bg-[#13131a] border-r border-white/5 shrink-0 w-12">
          {lines.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="flex-1 py-3 px-4 text-[13px] leading-6 font-mono bg-transparent text-gray-100 resize-none focus:outline-none"
          style={{ tabSize: 4 }}
        />
      </div>
    </div>
  )
}

// ── YAML / OpenAPI editor ──────────────────────────────────────────────────────
function DefinitionEditor({ value, onChange }) {
  return (
    <CodeEditor value={value} onChange={onChange} language="yaml" />
  )
}

// ── Auth row ───────────────────────────────────────────────────────────────────
const AUTH_TYPES = [
  { value: 'none',    label: 'No auth' },
  { value: 'api-key', label: 'API key' },
  { value: 'bearer',  label: 'Bearer token' },
  { value: 'basic',   label: 'Basic auth' },
]

function AuthConfig({ tool, set }) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="space-y-3">
      {/* Type select */}
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Auth type</label>
        <select
          value={tool.authType}
          onChange={(e) => set('authType', e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
        >
          {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      {tool.authType !== 'none' && (
        <>
          {/* Header name */}
          {tool.authType === 'api-key' && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Header name</label>
              <input
                value={tool.authHeader ?? ''}
                onChange={(e) => set('authHeader', e.target.value)}
                placeholder="e.g. X-Api-Key"
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
          )}
          {/* Key */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
              {tool.authType === 'basic' ? 'Username:Password' : 'Secret value'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={tool.apiKey ?? ''}
                onChange={(e) => set('apiKey', e.target.value)}
                placeholder="Enter secret…"
                className="w-full px-3.5 pr-10 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showKey
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tool card ─────────────────────────────────────────────────────────────────
function ToolCard({ tool, selected, onClick, onEdit, onDelete, onToggle }) {
  return (
    <div
      onClick={onClick}
      className={`group bg-white dark:bg-[#13131a] border rounded-xl p-5 flex flex-col gap-4 cursor-pointer transition-all ${
        selected
          ? 'border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-500/20 shadow-md dark:shadow-blue-500/5'
          : tool.enabled
          ? 'border-gray-200 dark:border-white/8 hover:border-blue-300 dark:hover:border-blue-500/40 hover:shadow-md dark:hover:shadow-blue-500/5'
          : 'border-dashed border-gray-200 dark:border-white/5 opacity-55'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl ${tool.color} flex items-center justify-center text-xl shrink-0`}>
            {tool.icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{tool.name}</h3>
            <div className="mt-0.5">
              <Badge label={tool.type === 'api' ? 'API' : 'Python'} variant={tool.type === 'api' ? 'api' : 'code'} />
            </div>
          </div>
        </div>
        <Toggle checked={tool.enabled} onChange={(e) => { e.stopPropagation(); onToggle(tool.id) }} />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 flex-1">
        {tool.description}
      </p>

      {/* Actions */}
      <div
        className="flex items-center gap-2 border-t border-gray-100 dark:border-white/5 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onEdit(tool)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Edit
        </button>
        <button
          onClick={() => onDelete(tool)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Form modal (add/edit) ──────────────────────────────────────────────────────
const DEFAULT_TOOL = {
  name: '', description: '', icon: '🔧', color: 'bg-blue-500', enabled: true, type: 'code',
  language: 'python', code: `def run(input: dict) -> dict:\n    \"\"\"\n    Tool entry point.\n\n    Args:\n        input: dict of parameters\n\n    Returns:\n        dict result\n    \"\"\"\n    return {"result": None}\n`,
  baseUrl: '', authType: 'none', authHeader: '', apiKey: '',
  apiDefinition: `openapi: 3.0.0\ninfo:\n  title: My Tool API\n  version: "1.0"\npaths:\n  /endpoint:\n    post:\n      operationId: myAction\n      summary: Describe this action\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              type: object\n      responses:\n        "200":\n          description: Success\n`,
}

function ToolFormModal({ editTool, onClose, onSave }) {
  const [form, setForm] = useState(editTool ?? DEFAULT_TOOL)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {editTool ? 'Edit tool' : 'New tool'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form id="tool-form" onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Preview + name row */}
          <div className="flex gap-3 items-start">
            <div className={`w-14 h-14 rounded-xl ${form.color} flex items-center justify-center text-2xl shrink-0`}>
              {form.icon}
            </div>
            <div className="flex-1 space-y-2">
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Tool name"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="What does this tool do?"
                rows={2}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => set('icon', ic)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === ic ? 'bg-blue-100 dark:bg-blue-500/20 ring-2 ring-blue-500/60' : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-lg ${c} transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#13131a] scale-110' : 'hover:scale-110'}`} />
              ))}
            </div>
          </div>

          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Source type</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: 'api', label: '🌐 API Definition', desc: 'OpenAPI / Swagger spec' }, { value: 'code', label: '🐍 Python Code', desc: 'Write a Python function' }].map((opt) => (
                <button key={opt.value} type="button" onClick={() => set('type', opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${form.type === opt.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'}`}>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/8 flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">Cancel</button>
          <button form="tool-form" type="submit" className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
            {editTool ? 'Save changes' : 'Create tool'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete modal ───────────────────────────────────────────────────────────────
function DeleteModal({ tool, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/8 p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/15 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Delete tool</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Are you sure you want to delete <span className="font-medium text-gray-800 dark:text-gray-200">{tool.name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────────
const PANEL_TABS = ['Overview', 'Source', 'Test']

function ToolDetailPanel({ tool, onClose, onUpdate }) {
  const [tab, setTab] = useState('Source')
  const [form, setForm] = useState(tool)
  const [dirty, setDirty] = useState(false)
  const [testInput, setTestInput] = useState('{\n  \n}')
  const [testOutput, setTestOutput] = useState('')

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true) }

  const handleSave = () => { onUpdate(form); setDirty(false) }
  const handleDiscard = () => { setForm(tool); setDirty(false) }

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 dark:bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-[580px] flex flex-col bg-white dark:bg-[#13131a] border-l border-gray-200 dark:border-white/8 shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-white/8 shrink-0">
          <div className={`w-9 h-9 rounded-xl ${form.color} flex items-center justify-center text-lg shrink-0`}>
            {form.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{form.name}</h2>
              <Badge label={form.type === 'api' ? 'API' : 'Python'} variant={form.type === 'api' ? 'api' : 'code'} />
            </div>
            <p className="text-xs text-gray-400 truncate">{form.description}</p>
          </div>
          {dirty && (
            <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Save
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200 dark:border-white/8 shrink-0 px-5">
          {PANEL_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Overview ── */}
          {tab === 'Overview' && (
            <div className="p-5 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Name</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none" />
              </div>

              {/* Icon + color */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => set('icon', ic)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === ic ? 'bg-blue-100 dark:bg-blue-500/20 ring-2 ring-blue-500/60' : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => set('color', c)}
                      className={`w-7 h-7 rounded-lg ${c} transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#13131a] scale-110' : 'hover:scale-110'}`} />
                  ))}
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/6" />

              {/* Enabled toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</p>
                  <p className="text-xs text-gray-400 mt-0.5">Allow agents to use this tool</p>
                </div>
                <Toggle checked={form.enabled} onChange={() => set('enabled', !form.enabled)} />
              </div>
            </div>
          )}

          {/* ── Source ── */}
          {tab === 'Source' && (
            <div className="p-5 space-y-5">
              {/* Type switcher */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Source type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ value: 'api', label: '🌐 API Definition', desc: 'OpenAPI / Swagger' }, { value: 'code', label: '🐍 Python Code', desc: 'Custom function' }].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => set('type', opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${form.type === opt.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'}`}>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── API branch ── */}
              {form.type === 'api' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Base URL</label>
                    <input value={form.baseUrl ?? ''} onChange={(e) => set('baseUrl', e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
                  </div>

                  <AuthConfig tool={form} set={set} />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">API Definition</label>
                      <span className="text-[11px] text-gray-400">OpenAPI 3.0 YAML or JSON</span>
                    </div>
                    <DefinitionEditor value={form.apiDefinition ?? ''} onChange={(v) => set('apiDefinition', v)} />
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-500/8 border border-blue-100 dark:border-blue-500/15 rounded-xl">
                    <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      The agent uses the <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">operationId</code> and parameter descriptions to decide when and how to call this tool.
                    </p>
                  </div>
                </>
              )}

              {/* ── Code branch ── */}
              {form.type === 'code' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-0.5">Language</label>
                      <div className="flex gap-2 mt-1">
                        {[{ value: 'python', label: '🐍 Python' }].map((l) => (
                          <button key={l.value} type="button" onClick={() => set('language', l.value)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${form.language === l.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'border-gray-200 dark:border-white/10 text-gray-500 hover:border-gray-300'}`}>
                            {l.label}
                          </button>
                        ))}
                        <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 dark:border-white/10 rounded-lg">
                          More coming soon
                        </span>
                      </div>
                    </div>
                  </div>

                  <CodeEditor value={form.code ?? ''} onChange={(v) => set('code', v)} language={form.language ?? 'python'} />

                  <div className="flex items-start gap-2 p-3 bg-violet-50 dark:bg-violet-500/8 border border-violet-100 dark:border-violet-500/15 rounded-xl">
                    <svg className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="text-xs text-violet-600 dark:text-violet-400 space-y-1">
                      <p>Define a <code className="bg-violet-100 dark:bg-violet-500/20 px-1 rounded font-mono">run(input: dict) -&gt; dict</code> function as the entry point.</p>
                      <p>The docstring is used by the agent to understand the tool's parameters and purpose.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Test ── */}
          {tab === 'Test' && (
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Test tool</p>
                  <p className="text-xs text-gray-400 mt-0.5">Provide a JSON input and run the tool to see the output.</p>
                </div>
                <button
                  onClick={() => setTestOutput(JSON.stringify({ status: 'ok', note: 'Live execution coming soon — connect a runtime to test here.' }, null, 2))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Run
                </button>
              </div>

              {/* Input */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Input (JSON)</label>
                <CodeEditor value={testInput} onChange={setTestInput} language="json" />
              </div>

              {/* Output */}
              {testOutput && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Output</label>
                  <CodeEditor value={testOutput} language="json" readOnly />
                </div>
              )}

              {!testOutput && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                  </div>
                  <p className="text-sm text-gray-400">Hit <span className="font-medium text-emerald-500">Run</span> to execute the tool with the input above.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {dirty && (
          <div className="px-5 py-3.5 border-t border-gray-200 dark:border-white/8 flex items-center justify-between bg-blue-50/80 dark:bg-blue-500/8 shrink-0">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Unsaved changes</p>
            <div className="flex gap-2">
              <button onClick={handleDiscard} className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-white/8 rounded-lg transition-colors">Discard</button>
              <button onClick={handleSave} className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">Save changes</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ToolsPage() {
  const { tools, add, update, remove, toggle } = useTools()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'api' | 'code'
  const [showForm, setShowForm] = useState(false)
  const [editTool, setEditTool] = useState(null)
  const [deleteTool, setDeleteTool] = useState(null)
  const [selectedTool, setSelectedTool] = useState(null)

  const filtered = tools.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || t.type === filter
    return matchSearch && matchFilter
  })

  const openAdd  = () => { setEditTool(null); setShowForm(true) }
  const openEdit = (t) => { setEditTool(t); setShowForm(true) }
  const handleSave   = (form) => (editTool ? update(form) : add(form))
  const handleDelete = () => { remove(deleteTool.id); setDeleteTool(null); if (selectedTool?.id === deleteTool.id) setSelectedTool(null) }
  const handleUpdate = (updated) => { update(updated); setSelectedTool(updated) }

  const active  = tools.filter((t) => t.enabled).length
  const apiCnt  = tools.filter((t) => t.type === 'api').length
  const codeCnt = tools.filter((t) => t.type === 'code').length

  return (
    <AppLayout>
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-gray-200 dark:border-white/8 bg-white dark:bg-[#13131a]">
        <div className="flex items-center gap-3">
          <h1 className="text-gray-900 dark:text-white font-semibold text-lg">Tools</h1>
          <span className="text-xs bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full">{active} active</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search tools..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-52 pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/8 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New tool
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total tools', value: tools.length, key: 'all', color: 'text-gray-900 dark:text-white' },
            { label: 'API tools',   value: apiCnt,       key: 'api',  color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Python tools',value: codeCnt,      key: 'code', color: 'text-violet-600 dark:text-violet-400' },
          ].map((s) => (
            <button key={s.key} onClick={() => setFilter(s.key)}
              className={`p-4 rounded-xl border text-left transition-all ${filter === s.key ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/8 ring-1 ring-blue-500/20' : 'border-gray-200 dark:border-white/8 bg-white dark:bg-[#13131a] hover:border-blue-300 dark:hover:border-blue-500/30'}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 11-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-1">No tools found</p>
            <p className="text-gray-400 text-sm mb-5">Create your first tool to extend agent capabilities.</p>
            <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New tool
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                selected={selectedTool?.id === tool.id}
                onClick={() => setSelectedTool(tool)}
                onEdit={openEdit}
                onDelete={setDeleteTool}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
      </main>

      {selectedTool && (
        <ToolDetailPanel
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
          onUpdate={handleUpdate}
        />
      )}
      {showForm && (
        <ToolFormModal
          editTool={editTool}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
      {deleteTool && (
        <DeleteModal
          tool={deleteTool}
          onClose={() => setDeleteTool(null)}
          onConfirm={handleDelete}
        />
      )}
    </AppLayout>
  )
}
