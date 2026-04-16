import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  Eye,
  Filter,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { toolsApi } from '@/lib/api/studio'
import type { ToolResponse } from '@/lib/api/studio-types'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

// ==============================================================================
// Types
// ==============================================================================

type ToolKind = 'api' | 'code'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
type HttpMethod = typeof HTTP_METHODS[number]

const PARAM_POSITIONS = ['query', 'header', 'path', 'body'] as const
type ParamPosition = typeof PARAM_POSITIONS[number]

const PARAM_TYPES = ['string', 'number', 'boolean', 'array', 'object'] as const
type ParamType = typeof PARAM_TYPES[number]

const LANGUAGES = ['javascript', 'python', 'typescript'] as const
type CodeLanguage = typeof LANGUAGES[number]

interface ApiParam {
  id: string
  name: string
  position: ParamPosition
  dataType: ParamType
  defaultValue: string
  description: string
  required: boolean
}

interface ApiConfig {
  kind: 'api'
  url: string
  method: HttpMethod
  maxCallsPerRequest: number
  requireApproval: boolean
  params: ApiParam[]
}

interface CodeConfig {
  kind: 'code'
  language: CodeLanguage
  code: string
  requireApproval: boolean
}

type ToolConfig = ApiConfig | CodeConfig

// ==============================================================================
// Helpers
// ==============================================================================

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function methodColor(m: string): 'green' | 'blue' | 'yellow' | 'red' | 'gray' {
  const map: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
    GET: 'green', POST: 'blue', PUT: 'yellow', PATCH: 'yellow', DELETE: 'red',
  }
  return map[m] ?? 'gray'
}

function positionBadgeVariant(p: ParamPosition): 'blue' | 'green' | 'yellow' | 'gray' {
  const m: Record<ParamPosition, 'blue' | 'green' | 'yellow' | 'gray'> = {
    header: 'blue', query: 'green', path: 'yellow', body: 'gray',
  }
  return m[p]
}

const DEFAULT_API_CONFIG: ApiConfig = {
  kind: 'api', url: '', method: 'GET', maxCallsPerRequest: 1, requireApproval: false, params: [],
}

const DEFAULT_CODE_CONFIG: CodeConfig = {
  kind: 'code',
  language: 'javascript',
  code: '// Your function code here\nasync function run(inputs) {\n  return { result: null }\n}\n',
  requireApproval: false,
}

function parseConfig(raw: Record<string, unknown>): ToolConfig {
  if (raw.kind === 'code') {
    return {
      kind: 'code',
      language: (raw.language as CodeLanguage) ?? 'javascript',
      code: typeof raw.code === 'string' ? raw.code : '',
      requireApproval: Boolean(raw.requireApproval),
    }
  }
  return {
    kind: 'api',
    url: typeof raw.url === 'string' ? raw.url : '',
    method: (raw.method as HttpMethod) ?? 'GET',
    maxCallsPerRequest: typeof raw.maxCallsPerRequest === 'number' ? raw.maxCallsPerRequest : 1,
    requireApproval: Boolean(raw.requireApproval),
    params: Array.isArray(raw.params)
      ? (raw.params as ApiParam[]).map(p => ({ ...p, id: p.id ?? uid() }))
      : [],
  }
}

function configToRecord(c: ToolConfig): Record<string, unknown> {
  return c as unknown as Record<string, unknown>
}

function deriveInputSchema(config: ApiConfig): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const p of config.params) {
    properties[p.name] = {
      type: p.dataType,
      description: p.description || undefined,
      default: p.defaultValue || undefined,
      in: p.position,
    }
    if (p.required) required.push(p.name)
  }
  return { type: 'object', properties, required }
}

// ==============================================================================
// SelectField
// ==============================================================================

function SelectField({
  label, value, options, onChange, small,
}: {
  label?: string; value: string; options: readonly string[]
  onChange: (v: string) => void; small?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1', small && 'min-w-0')}>
      {label && <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cn(
            'w-full appearance-none rounded-lg border border-gray-200 bg-white pr-7 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100',
            small ? 'h-8 pl-2' : 'h-9 pl-3',
          )}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  )
}

// ==============================================================================
// ApiParamCard
// ==============================================================================

function ApiParamCard({ param, index, onChange, onRemove }: {
  param: ApiParam; index: number
  onChange: (p: ApiParam) => void; onRemove: () => void
}) {
  function set<K extends keyof ApiParam>(key: K, v: ApiParam[K]) {
    onChange({ ...param, [key]: v })
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-border-dark dark:bg-card-dark">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-border-dark">
        <GripVertical size={14} className="shrink-0 text-gray-300 dark:text-gray-600" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Parameter #{index + 1}</span>
        <Badge variant={positionBadgeVariant(param.position)} className="uppercase text-[10px]">{param.position}</Badge>
        <Badge variant="blue" className="uppercase text-[10px]">{param.dataType}</Badge>
        {param.required && (
          <span className="rounded-full border border-red-400 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-500">Required</span>
        )}
        <button type="button" onClick={onRemove}
          className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          aria-label="Remove parameter">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <Input label="Parameter Name *" placeholder="X-Api-Key" value={param.name} onChange={e => set('name', e.target.value)} />
        <SelectField label="Position *" value={param.position} options={PARAM_POSITIONS} onChange={v => set('position', v as ParamPosition)} />
        <SelectField label="Data Type *" value={param.dataType} options={PARAM_TYPES} onChange={v => set('dataType', v as ParamType)} />
        <Input label="Default value" placeholder="(optional)" value={param.defaultValue} onChange={e => set('defaultValue', e.target.value)} />
      </div>
      <div className="px-4 pb-3">
        <Input label="Description" placeholder="What does this parameter do?" value={param.description} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="px-4 pb-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <input type="checkbox" checked={param.required} onChange={e => set('required', e.target.checked)} className="rounded accent-brand-600" />
          This parameter is required
        </label>
      </div>
    </div>
  )
}

// ==============================================================================
// ApiConfigPanel
// ==============================================================================

function ApiConfigPanel({ config, onChange }: { config: ApiConfig; onChange: (c: ApiConfig) => void }) {
  function set<K extends keyof ApiConfig>(key: K, v: ApiConfig[K]) { onChange({ ...config, [key]: v }) }

  function addParam() {
    const p: ApiParam = { id: uid(), name: '', position: 'query', dataType: 'string', defaultValue: '', description: '', required: false }
    set('params', [...config.params, p])
  }
  function updateParam(id: string, updated: ApiParam) { set('params', config.params.map(p => p.id === id ? updated : p)) }
  function removeParam(id: string) { set('params', config.params.filter(p => p.id !== id)) }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3">
        <Input label="API Endpoint URL *" placeholder="https://api.example.com/v1/endpoint" value={config.url} onChange={e => set('url', e.target.value)} />
        <SelectField label="Method" value={config.method} options={HTTP_METHODS} onChange={v => set('method', v as HttpMethod)} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Max calls</label>
          <input type="number" min={1} max={100} value={config.maxCallsPerRequest}
            onChange={e => set('maxCallsPerRequest', Number(e.target.value))}
            className="h-9 w-20 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100" />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={config.requireApproval} onChange={e => set('requireApproval', e.target.checked)} className="rounded accent-brand-600" />
        Require human approval before execution
      </label>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Parameters</p>
            <p className="text-xs text-gray-400">Configure headers, query params, path variables and body fields</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={addParam}><Plus size={13} /> Add Parameter</Button>
        </div>
        {config.params.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400 dark:border-border-dark">
            No parameters yet. Click "Add Parameter" to configure request inputs.
          </div>
        ) : (
          <div className="space-y-3">
            {config.params.map((p, i) => (
              <ApiParamCard key={p.id} param={p} index={i} onChange={u => updateParam(p.id, u)} onRemove={() => removeParam(p.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==============================================================================
// CodeConfigPanel
// ==============================================================================

function CodeConfigPanel({ config, onChange }: { config: CodeConfig; onChange: (c: CodeConfig) => void }) {
  function set<K extends keyof CodeConfig>(key: K, v: CodeConfig[K]) { onChange({ ...config, [key]: v }) }
  return (
    <div className="space-y-4">
      <SelectField label="Language" value={config.language} options={LANGUAGES} onChange={v => set('language', v as CodeLanguage)} />
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Function Code</label>
        <p className="text-xs text-gray-400">
          {'The function must be named '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">run</code>
          {' and accept an '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">inputs</code>
          {' object.'}
        </p>
        <textarea value={config.code} onChange={e => set('code', e.target.value)}
          rows={16} spellCheck={false}
          className="w-full rounded-lg border border-gray-200 bg-gray-900 p-3 font-mono text-xs leading-relaxed text-green-300 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark" />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={config.requireApproval} onChange={e => set('requireApproval', e.target.checked)} className="rounded accent-brand-600" />
        Require human approval before execution
      </label>
    </div>
  )
}

// ==============================================================================
// Tool Form Modal (shared Create + Edit)
// ==============================================================================

const MODAL_TABS = ['Basic', 'Configuration'] as const
type ModalTab = typeof MODAL_TABS[number]

interface FormInitial {
  name: string; description: string; kind: ToolKind; isActive: boolean; config: ToolConfig
}

interface SavePayload {
  name: string; description: string; type: ToolKind; isActive: boolean
  config: Record<string, unknown>; inputSchema: Record<string, unknown>
}

function ToolFormModal({ open, onClose, initial, onSave, title, submitLabel }: {
  open: boolean; onClose: () => void; initial: FormInitial
  onSave: (payload: SavePayload) => Promise<void>; title: string; submitLabel: string
}) {
  const [tab, setTab] = useState<ModalTab>('Basic')
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [isActive, setIsActive] = useState(initial.isActive)
  const [kind, setKind] = useState<ToolKind>(initial.kind)
  const [apiConfig, setApiConfig] = useState<ApiConfig>(
    initial.config.kind === 'api' ? (initial.config as ApiConfig) : DEFAULT_API_CONFIG
  )
  const [codeConfig, setCodeConfig] = useState<CodeConfig>(
    initial.config.kind === 'code' ? (initial.config as CodeConfig) : DEFAULT_CODE_CONFIG
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); setTab('Basic'); return }
    if (kind === 'api' && !apiConfig.url.trim()) { setError('API URL is required'); setTab('Configuration'); return }
    if (kind === 'code' && !codeConfig.code.trim()) { setError('Code is required'); setTab('Configuration'); return }
    setError('')
    setLoading(true)
    try {
      const chosenConfig = kind === 'api' ? apiConfig : codeConfig
      const inputSchema = kind === 'api' ? deriveInputSchema(apiConfig) : {}
      await onSave({ name, description, type: kind, isActive, config: configToRecord(chosenConfig), inputSchema })
    } catch {
      setError('Failed to save tool. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="-mx-6 flex border-b border-gray-200 px-6 dark:border-border-dark">
          {MODAL_TABS.map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn('-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                           : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')}>
              {t}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {tab === 'Basic' && (
            <div className="space-y-4">
              <Input label="Tool Name *" placeholder="Customer Lookup API" value={name}
                onChange={e => setName(e.target.value)} autoFocus />
              <Textarea label="Description" placeholder="What does this tool do?" rows={3}
                value={description} onChange={e => setDescription(e.target.value)} />
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tool Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['api', 'code'] as ToolKind[]).map(k => (
                    <button key={k} type="button" onClick={() => setKind(k)}
                      className={cn('flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                        kind === k ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                   : 'border-gray-200 hover:border-gray-300 dark:border-border-dark')}>
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        kind === k ? 'bg-brand-100 dark:bg-brand-800/40' : 'bg-gray-100 dark:bg-gray-700')}>
                        {k === 'api'
                          ? <Link2 size={16} className={kind === k ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'} />
                          : <Wrench size={16} className={kind === k ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'} />
                        }
                      </div>
                      <div>
                        <p className={cn('text-sm font-semibold', kind === k ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-200')}>
                          {k === 'api' ? 'API Tool' : 'Code Tool'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {k === 'api' ? 'Call external HTTP endpoints' : 'Run custom function code'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded accent-brand-600" />
                Active
              </label>
            </div>
          )}

          {tab === 'Configuration' && (
            kind === 'api'
              ? <ApiConfigPanel config={apiConfig} onChange={setApiConfig} />
              : <CodeConfigPanel config={codeConfig} onChange={setCodeConfig} />
          )}
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ==============================================================================
// View Modal (read-only detail)
// ==============================================================================

function ToolViewModal({ tool, onClose, onEdit }: { tool: ToolResponse; onClose: () => void; onEdit: () => void }) {
  const cfg = parseConfig(tool.config ?? {})
  return (
    <Modal open onClose={onClose} title="Tool Detail" size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{tool.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-gray-400">{tool.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={tool.isActive ? 'green' : 'gray'}>{tool.isActive ? 'Active' : 'Inactive'}</Badge>
            <Badge variant={cfg.kind === 'api' ? 'blue' : 'yellow'}>{cfg.kind === 'api' ? 'API' : 'Code'}</Badge>
          </div>
        </div>
        {tool.description && <p className="text-sm text-gray-600 dark:text-gray-300">{tool.description}</p>}

        {cfg.kind === 'api' && (
          <>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl border border-gray-200 p-4 dark:border-border-dark">
              <div>
                <p className="text-xs font-semibold text-gray-400">URL</p>
                <a href={cfg.url} target="_blank" rel="noopener noreferrer"
                  className="mt-0.5 break-all font-mono text-sm text-brand-600 hover:underline dark:text-brand-400">
                  {cfg.url || '—'}
                </a>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400">Method</p>
                <div className="mt-1"><Badge variant={methodColor(cfg.method)}>{cfg.method}</Badge></div>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400">Max calls</p>
                <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">{cfg.maxCallsPerRequest}</p>
              </div>
            </div>
            {cfg.params.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Parameters</p>
                {cfg.params.map((p, i) => (
                  <div key={p.id} className="rounded-xl border border-gray-200 p-4 dark:border-border-dark">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Parameter #{i + 1}</span>
                      <Badge variant={positionBadgeVariant(p.position)} className="uppercase text-[10px]">{p.position}</Badge>
                      <Badge variant="blue" className="uppercase text-[10px]">{p.dataType}</Badge>
                      {p.required && <span className="rounded-full border border-red-400 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-500">Required</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div><p className="font-semibold text-gray-400">Name</p><p className="mt-0.5 font-mono text-gray-700 dark:text-gray-200">{p.name || '—'}</p></div>
                      <div><p className="font-semibold text-gray-400">Default</p><p className="mt-0.5 font-mono text-gray-700 dark:text-gray-200">{p.defaultValue || '—'}</p></div>
                      <div><p className="font-semibold text-gray-400">Description</p><p className="mt-0.5 text-gray-700 dark:text-gray-200">{p.description || '—'}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {cfg.kind === 'code' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-400">Language</p>
              <Badge variant="gray">{(cfg as CodeConfig).language}</Badge>
            </div>
            <pre className="max-h-80 overflow-y-auto rounded-xl bg-gray-900 p-4 font-mono text-xs leading-relaxed text-green-300">
              {(cfg as CodeConfig).code}
            </pre>
          </div>
        )}

        {cfg.requireApproval && (
          <p className="rounded-lg bg-yellow-50 px-3 py-2 text-xs font-medium text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            {'\u26a0'} This tool requires human approval before execution
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Close</Button>
          <Button type="button" onClick={onEdit}><Pencil size={13} /> Edit</Button>
        </div>
      </div>
    </Modal>
  )
}

// ==============================================================================
// Tools Page
// ==============================================================================

export function ToolsPage() {
  const [tools, setTools] = useState<ToolResponse[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [viewingTool, setViewingTool] = useState<ToolResponse | null>(null)
  const [editingTool, setEditingTool] = useState<ToolResponse | null>(null)
  const [deletingTool, setDeletingTool] = useState<ToolResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await toolsApi.list(search || undefined, page)
      if (res.data) { setTools(res.data.content); setTotal(res.data.totalElements) }
    } finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(0) }, [search])

  async function confirmDelete() {
    if (!deletingTool) return
    await toolsApi.delete(deletingTool.id)
    setTools(prev => prev.filter(t => t.id !== deletingTool.id))
    setTotal(prev => prev - 1)
  }

  const displayed = tools.filter(t =>
    (typeFilter ? t.type === typeFilter : true) &&
    (statusFilter === 'active' ? t.isActive : statusFilter === 'inactive' ? !t.isActive : true)
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Tools management</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Create, view, update and delete tools for your AI Agents.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools..."
              className="h-9 w-56 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-100" />
          </div>
          <div className="relative">
            <Filter size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-200">
              <option value="">All types</option>
              <option value="api">API</option>
              <option value="code">Code</option>
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <Filter size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-card-dark dark:text-gray-200">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Tool</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border-dark dark:bg-card-dark">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading...</div>
        ) : displayed.length === 0 ? (
          <EmptyState icon={Wrench} title="No tools found"
            description="Create a tool to connect your agents to external systems"
            action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Tool</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-border-dark dark:bg-panel-dark">
                  <th className="px-5 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Tool Name</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Description</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Type / Endpoint</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">HTTP Method</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="w-28 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-border-dark">
                {displayed.map(tool => {
                  const cfg = parseConfig(tool.config ?? {})
                  const isApi = cfg.kind === 'api'
                  return (
                    <tr key={tool.id} className="hover:bg-gray-50 dark:hover:bg-panel-dark">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                            isApi ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20')}>
                            {isApi
                              ? <Link2 size={13} className="text-blue-600 dark:text-blue-400" />
                              : <Wrench size={13} className="text-yellow-600 dark:text-yellow-400" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{tool.name}</p>
                            <p className="font-mono text-[10px] text-gray-400">{tool.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-xs px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                        <p className="line-clamp-2">{tool.description ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3">
                        {isApi ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Link2 size={11} className="shrink-0 text-gray-400" />
                            <span className="max-w-[14rem] truncate font-mono text-brand-600 dark:text-brand-400">
                              {(cfg as ApiConfig).url || '—'}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="yellow">Code</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {isApi
                          ? <Badge variant={methodColor((cfg as ApiConfig).method)}>{(cfg as ApiConfig).method}</Badge>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={tool.isActive ? 'green' : 'gray'}>{tool.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewingTool(tool)}
                            className="rounded p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400" aria-label="View">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => setEditingTool(tool)}
                            className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400" aria-label="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeletingTool(tool)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" aria-label="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-gray-500">Page {page + 1}</span>
          <Button variant="secondary" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {showCreate && (
        <ToolFormModal open title="Create Tool" submitLabel="Create Tool"
          initial={{ name: '', description: '', kind: 'api', isActive: true, config: DEFAULT_API_CONFIG }}
          onClose={() => setShowCreate(false)}
          onSave={async (payload) => {
            const res = await toolsApi.create({
              name: payload.name, type: payload.type,
              description: payload.description || undefined,
              config: payload.config, inputSchema: payload.inputSchema,
            })
            if (res.data) { setTools(prev => [res.data!, ...prev]); setTotal(v => v + 1); setShowCreate(false) }
          }} />
      )}

      {editingTool && (
        <ToolFormModal open title="Edit Tool" submitLabel="Save Changes"
          initial={{
            name: editingTool.name, description: editingTool.description ?? '',
            kind: (editingTool.type === 'code' ? 'code' : 'api') as ToolKind,
            isActive: editingTool.isActive, config: parseConfig(editingTool.config ?? {}),
          }}
          onClose={() => setEditingTool(null)}
          onSave={async (payload) => {
            const res = await toolsApi.update(editingTool.id, {
              name: payload.name, type: payload.type,
              description: payload.description || undefined,
              config: payload.config, inputSchema: payload.inputSchema, isActive: payload.isActive,
            })
            if (res.data) { setTools(prev => prev.map(t => t.id === res.data!.id ? res.data! : t)); setEditingTool(null) }
          }} />
      )}

      {viewingTool && (
        <ToolViewModal tool={viewingTool} onClose={() => setViewingTool(null)}
          onEdit={() => { setEditingTool(viewingTool); setViewingTool(null) }} />
      )}

      <DeleteConfirmModal open={!!deletingTool} onClose={() => setDeletingTool(null)}
        itemName={deletingTool?.name ?? ''} entityType="tool" onConfirm={confirmDelete} />
    </div>
  )
}
