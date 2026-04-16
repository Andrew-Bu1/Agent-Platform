import { useCallback, useEffect, useState } from 'react'
import {
  Brain,
  ChevronDown,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Zap,
} from 'lucide-react'
import {
  featureEntitlementsApi,
  modelEntitlementsApi,
  tenantsApi,
} from '@/lib/api/access'
import type {
  CreateFeatureEntitlementRequest,
  CreateModelEntitlementRequest,
  FeatureEntitlementResponse,
  ModelEntitlementResponse,
  TenantResponse,
  UpdateFeatureEntitlementRequest,
  UpdateModelEntitlementRequest,
} from '@/lib/api/access-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

// ============================================================================
// Feature Entitlement Modals
// ============================================================================

function CreateFeatureModal({
  tenantId,
  open,
  onClose,
  onCreated,
}: {
  tenantId: string
  open: boolean
  onClose: () => void
  onCreated: (f: FeatureEntitlementResponse) => void
}) {
  const [form, setForm] = useState<CreateFeatureEntitlementRequest>({
    featureKey: '',
    enabled: true,
    config: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setForm({ featureKey: '', enabled: true, config: '' })
    setError('')
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.featureKey.trim()) { setError('Feature key is required'); return }
    if (form.config) {
      try { JSON.parse(form.config) } catch { setError('Config must be valid JSON'); return }
    }
    setLoading(true)
    setError('')
    try {
      const created = await featureEntitlementsApi.create(tenantId, {
        featureKey: form.featureKey.trim(),
        enabled: form.enabled,
        config: form.config?.trim() || undefined,
      })
      onCreated(created)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add feature entitlement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Feature key"
          value={form.featureKey}
          onChange={e => setForm(f => ({ ...f, featureKey: e.target.value }))}
          placeholder="e.g. agent.run"
          required
        />

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.enabled ?? true}
            onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
        </label>

        <Textarea
          label="Config (JSON)"
          value={form.config ?? ''}
          onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
          placeholder='{"max_agents": 50}'
          rows={3}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Add</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditFeatureModal({
  tenantId,
  item,
  open,
  onClose,
  onUpdated,
}: {
  tenantId: string
  item: FeatureEntitlementResponse | null
  open: boolean
  onClose: () => void
  onUpdated: (f: FeatureEntitlementResponse) => void
}) {
  const [form, setForm] = useState<UpdateFeatureEntitlementRequest>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item) setForm({ enabled: item.enabled, config: item.config ?? '' })
  }, [item])

  function handleClose() {
    if (loading) return
    setError('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    if (form.config) {
      try { JSON.parse(form.config) } catch { setError('Config must be valid JSON'); return }
    }
    setLoading(true)
    setError('')
    try {
      const updated = await featureEntitlementsApi.update(tenantId, item.id, {
        enabled: form.enabled,
        config: form.config?.trim() || undefined,
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Edit — ${item?.featureKey ?? ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.enabled ?? true}
            onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
        </label>
        <Textarea
          label="Config (JSON)"
          value={form.config ?? ''}
          onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
          placeholder="{}"
          rows={4}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// Model Entitlement Modals
// ============================================================================

const OP_TYPES = ['chat', 'embedding', 'rerank', 'completion']

function CreateModelModal({
  tenantId,
  open,
  onClose,
  onCreated,
}: {
  tenantId: string
  open: boolean
  onClose: () => void
  onCreated: (m: ModelEntitlementResponse) => void
}) {
  const [form, setForm] = useState<CreateModelEntitlementRequest>({
    modelKey: '',
    operationType: 'chat',
    allowed: true,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setForm({ modelKey: '', operationType: 'chat', allowed: true })
    setError('')
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.modelKey.trim()) { setError('Model key is required'); return }
    setLoading(true)
    setError('')
    try {
      const created = await modelEntitlementsApi.create(tenantId, {
        ...form,
        modelKey: form.modelKey.trim(),
      })
      onCreated(created)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setLoading(false)
    }
  }

  function num(val: string) {
    const n = parseInt(val, 10)
    return isNaN(n) ? null : n
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add model entitlement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Model key"
          value={form.modelKey}
          onChange={e => setForm(f => ({ ...f, modelKey: e.target.value }))}
          placeholder="e.g. openrouter:gpt-4.1"
          required
        />

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Operation type</label>
          <select
            value={form.operationType}
            onChange={e => setForm(f => ({ ...f, operationType: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-border-dark dark:bg-surface-dark dark:text-white"
          >
            {OP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.allowed ?? true}
            onChange={e => setForm(f => ({ ...f, allowed: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Allowed</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="RPM limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.rpmLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, rpmLimit: num(e.target.value) }))}
          />
          <Input
            label="TPM limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.tpmLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, tpmLimit: num(e.target.value) }))}
          />
          <Input
            label="Daily token limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.dailyTokenLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, dailyTokenLimit: num(e.target.value) }))}
          />
          <Input
            label="Monthly token limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.monthlyTokenLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, monthlyTokenLimit: num(e.target.value) }))}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Add</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditModelModal({
  tenantId,
  item,
  open,
  onClose,
  onUpdated,
}: {
  tenantId: string
  item: ModelEntitlementResponse | null
  open: boolean
  onClose: () => void
  onUpdated: (m: ModelEntitlementResponse) => void
}) {
  const [form, setForm] = useState<UpdateModelEntitlementRequest>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item) {
      setForm({
        allowed: item.allowed,
        rpmLimit: item.rpmLimit,
        tpmLimit: item.tpmLimit,
        dailyTokenLimit: item.dailyTokenLimit,
        monthlyTokenLimit: item.monthlyTokenLimit,
        config: item.config ?? '',
      })
    }
  }, [item])

  function handleClose() {
    if (loading) return
    setError('')
    onClose()
  }

  function num(val: string) {
    const n = parseInt(val, 10)
    return isNaN(n) ? null : n
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    if (form.config) {
      try { JSON.parse(form.config) } catch { setError('Config must be valid JSON'); return }
    }
    setLoading(true)
    setError('')
    try {
      const updated = await modelEntitlementsApi.update(tenantId, item.id, {
        ...form,
        config: form.config?.trim() || undefined,
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Edit — ${item?.modelKey ?? ''} / ${item?.operationType ?? ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.allowed ?? true}
            onChange={e => setForm(f => ({ ...f, allowed: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Allowed</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="RPM limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.rpmLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, rpmLimit: num(e.target.value) }))}
          />
          <Input
            label="TPM limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.tpmLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, tpmLimit: num(e.target.value) }))}
          />
          <Input
            label="Daily token limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.dailyTokenLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, dailyTokenLimit: num(e.target.value) }))}
          />
          <Input
            label="Monthly token limit"
            type="number"
            min={0}
            placeholder="unlimited"
            value={form.monthlyTokenLimit ?? ''}
            onChange={e => setForm(f => ({ ...f, monthlyTokenLimit: num(e.target.value) }))}
          />
        </div>

        <Textarea
          label="Config (JSON)"
          value={form.config ?? ''}
          onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
          placeholder="{}"
          rows={3}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// Feature Entitlements Tab
// ============================================================================

function FeatureTab({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<FeatureEntitlementResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<FeatureEntitlementResponse | null>(null)
  const [deleteItem, setDeleteItem] = useState<FeatureEntitlementResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await featureEntitlementsApi.list(tenantId)
      setItems(page.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { void load() }, [load])

  async function handleToggle(item: FeatureEntitlementResponse) {
    try {
      const updated = await featureEntitlementsApi.update(tenantId, item.id, { enabled: !item.enabled })
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!deleteItem) return
    await featureEntitlementsApi.delete(tenantId, deleteItem.id)
    setItems(prev => prev.filter(i => i.id !== deleteItem.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {items.length} feature entitlement{items.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setCreateOpen(true)}><Plus size={15} />Add feature</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error} <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No feature entitlements"
          description="Add feature flags to control what this tenant can access."
          action={<Button onClick={() => setCreateOpen(true)}><Plus size={15} />Add feature</Button>}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <div
              key={item.id}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark"
            >
              <button
                onClick={() => handleToggle(item)}
                className={item.enabled
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-300 dark:text-gray-600'}
                title={item.enabled ? 'Disable' : 'Enable'}
              >
                {item.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {item.featureKey}
                </p>
                <Badge variant={item.enabled ? 'green' : 'gray'} className="mt-0.5">
                  {item.enabled ? 'enabled' : 'disabled'}
                </Badge>
              </div>

              <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                <button
                  onClick={() => setEditItem(item)}
                  className="rounded p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setDeleteItem(item)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateFeatureModal
        tenantId={tenantId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={f => setItems(prev => [f, ...prev])}
      />
      <EditFeatureModal
        tenantId={tenantId}
        item={editItem}
        open={editItem !== null}
        onClose={() => setEditItem(null)}
        onUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
      />
      <DeleteConfirmModal
        open={deleteItem !== null}
        onClose={() => setDeleteItem(null)}
        itemName={deleteItem?.featureKey ?? ''}
        entityType="feature entitlement"
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ============================================================================
// Model Entitlements Tab
// ============================================================================

function opBadgeVariant(op: string): 'blue' | 'yellow' | 'green' | 'gray' {
  if (op === 'chat') return 'blue'
  if (op === 'embedding') return 'yellow'
  if (op === 'rerank') return 'green'
  return 'gray'
}

function LimitCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-xs">
      <span className="text-gray-400">{label}: </span>
      <span className="font-medium text-gray-700 dark:text-gray-200">
        {value !== null ? value.toLocaleString() : <span className="italic text-gray-300 dark:text-gray-600">∞</span>}
      </span>
    </div>
  )
}

function ModelTab({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<ModelEntitlementResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [opFilter, setOpFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<ModelEntitlementResponse | null>(null)
  const [deleteItem, setDeleteItem] = useState<ModelEntitlementResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await modelEntitlementsApi.list(tenantId)
      setItems(page.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { void load() }, [load])

  const filtered = opFilter === 'all' ? items : items.filter(i => i.operationType === opFilter)

  async function handleDelete() {
    if (!deleteItem) return
    await modelEntitlementsApi.delete(tenantId, deleteItem.id)
    setItems(prev => prev.filter(i => i.id !== deleteItem.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            value={opFilter}
            onChange={e => setOpFilter(e.target.value)}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-border-dark dark:bg-surface-dark dark:text-gray-200"
          >
            <option value="all">All operations</option>
            {OP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <span className="flex-1 text-sm text-gray-400">{filtered.length} entitlement{filtered.length !== 1 ? 's' : ''}</span>
        <Button onClick={() => setCreateOpen(true)}><Plus size={15} />Add model</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error} <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No model entitlements"
          description="Configure which AI models this tenant can use."
          action={<Button onClick={() => setCreateOpen(true)}><Plus size={15} />Add model</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div
              key={item.id}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-border-dark dark:bg-card-dark"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
                <Brain size={15} className="text-brand-600 dark:text-brand-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {item.modelKey}
                  </span>
                  <Badge variant={opBadgeVariant(item.operationType)}>{item.operationType}</Badge>
                  <Badge variant={item.allowed ? 'green' : 'red'}>{item.allowed ? 'allowed' : 'blocked'}</Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                  <LimitCell label="RPM" value={item.rpmLimit} />
                  <LimitCell label="TPM" value={item.tpmLimit} />
                  <LimitCell label="Daily" value={item.dailyTokenLimit} />
                  <LimitCell label="Monthly" value={item.monthlyTokenLimit} />
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                <button
                  onClick={() => setEditItem(item)}
                  className="rounded p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteItem(item)}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateModelModal
        tenantId={tenantId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={m => setItems(prev => [m, ...prev])}
      />
      <EditModelModal
        tenantId={tenantId}
        item={editItem}
        open={editItem !== null}
        onClose={() => setEditItem(null)}
        onUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
      />
      <DeleteConfirmModal
        open={deleteItem !== null}
        onClose={() => setDeleteItem(null)}
        itemName={deleteItem ? `${deleteItem.modelKey} / ${deleteItem.operationType}` : ''}
        entityType="model entitlement"
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ============================================================================
// Page
// ============================================================================

type Tab = 'features' | 'models'

export default function EntitlementsPage() {
  const [tenants, setTenants] = useState<TenantResponse[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [tenantsLoading, setTenantsLoading] = useState(true)
  const [tenantsError, setTenantsError] = useState('')
  const [tab, setTab] = useState<Tab>('features')

  useEffect(() => {
    setTenantsLoading(true)
    tenantsApi.list()
      .then(res => {
        const list = res.data?.content ?? []
        setTenants(list)
        if (list.length > 0) setSelectedTenantId(list[0].id)
      })
      .catch(err => setTenantsError(err instanceof Error ? err.message : 'Failed to load tenants'))
      .finally(() => setTenantsLoading(false))
  }, [])

  const selectedTenant = tenants.find(t => t.id === selectedTenantId)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Entitlements</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage feature flags and AI model permissions per tenant.
        </p>
      </div>

      {/* Tenant selector */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-border-dark dark:bg-card-dark">
        <span className="shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">Tenant</span>

        {tenantsLoading ? (
          <span className="text-sm text-gray-400">Loading tenants...</span>
        ) : tenantsError ? (
          <span className="text-sm text-red-500">{tenantsError}</span>
        ) : (
          <div className="relative flex-1 max-w-xs">
            <select
              value={selectedTenantId}
              onChange={e => setSelectedTenantId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-border-dark dark:bg-surface-dark dark:text-white"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        )}

        {selectedTenant && (
          <Badge variant={selectedTenant.status === 'active' ? 'green' : 'gray'}>
            {selectedTenant.planKey}
          </Badge>
        )}
      </div>

      {selectedTenantId && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-border-dark">
            {([['features', 'Feature Entitlements'], ['models', 'Model Entitlements']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'px-4 py-2 text-sm font-medium transition-colors',
                  tab === t
                    ? 'border-b-2 border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content — re-mount on tenant change to reset state */}
          {tab === 'features'
            ? <FeatureTab key={`feat-${selectedTenantId}`} tenantId={selectedTenantId} />
            : <ModelTab key={`model-${selectedTenantId}`} tenantId={selectedTenantId} />}
        </>
      )}
    </div>
  )
}
