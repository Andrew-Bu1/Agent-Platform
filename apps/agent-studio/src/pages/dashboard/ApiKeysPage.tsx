import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Key,
  Pencil,
  Plus,
  Search,
  ShieldOff,
  Trash2,
} from 'lucide-react'
import { apiKeysApi, tenantsApi } from '@/lib/api/access'
import type {
  ApiKeyResponse,
  CreateApiKeyRequest,
  TenantResponse,
  UpdateApiKeyRequest,
} from '@/lib/api/access-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

// ---- helpers ----------------------------------------------------------------

function statusVariant(status: string): 'green' | 'red' | 'gray' {
  if (status === 'active') return 'green'
  if (status === 'revoked') return 'red'
  return 'gray'
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fmtRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmt(dateStr)
}

// ============================================================================
// Raw Key Reveal Banner (shown once after creation)
// ============================================================================

function RawKeyBanner({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
            Save your API key — it won't be shown again
          </p>
          <p className="mt-0.5 text-xs text-yellow-600 dark:text-yellow-400">
            Copy and store this key securely before leaving this page.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-yellow-200 bg-white px-3 py-2 font-mono text-xs break-all text-gray-800 dark:border-yellow-700 dark:bg-surface-dark dark:text-gray-100">
              {visible ? rawKey : '•'.repeat(Math.min(rawKey.length, 48))}
            </code>
            <button
              onClick={() => setVisible(v => !v)}
              className="rounded p-1.5 text-yellow-600 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900/40"
              title={visible ? 'Hide key' : 'Show key'}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={handleCopy}
              className="rounded p-1.5 text-yellow-600 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900/40"
              title="Copy key"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-yellow-600 underline dark:text-yellow-400"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Create API Key Modal
// ============================================================================

function CreateApiKeyModal({
  tenantId,
  open,
  onClose,
  onCreated,
}: {
  tenantId: string
  open: boolean
  onClose: () => void
  onCreated: (key: ApiKeyResponse) => void
}) {
  const [form, setForm] = useState<CreateApiKeyRequest>({ name: '', scopes: '', expiresAt: null })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) { setForm({ name: '', scopes: '', expiresAt: null }); setError('') }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    setLoading(true)
    try {
      const body: CreateApiKeyRequest = {
        name: form.name.trim(),
        scopes: form.scopes?.trim() || undefined,
        expiresAt: form.expiresAt || undefined,
      }
      const key = await apiKeysApi.create(tenantId, body)
      onCreated(key)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create API Key">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="e.g. nightly-sync"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Scopes{' '}
            <span className="text-xs font-normal text-gray-400">(JSON array)</span>
          </label>
          <Textarea
            placeholder='["agent:run","datasource:read"]'
            value={form.scopes ?? ''}
            onChange={e => setForm(f => ({ ...f, scopes: e.target.value }))}
            rows={2}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Expires at{' '}
            <span className="text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <Input
            type="date"
            value={form.expiresAt ? form.expiresAt.split('T')[0] : ''}
            onChange={e =>
              setForm(f => ({
                ...f,
                expiresAt: e.target.value ? `${e.target.value}T00:00:00Z` : null,
              }))
            }
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Key
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// Edit API Key Modal
// ============================================================================

function EditApiKeyModal({
  apiKey,
  open,
  onClose,
  onUpdated,
}: {
  apiKey: ApiKeyResponse
  open: boolean
  onClose: () => void
  onUpdated: (key: ApiKeyResponse) => void
}) {
  const [form, setForm] = useState<UpdateApiKeyRequest>({
    name: apiKey.name,
    scopes: apiKey.scopes ?? '',
    expiresAt: apiKey.expiresAt,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ name: apiKey.name, scopes: apiKey.scopes ?? '', expiresAt: apiKey.expiresAt })
      setError('')
    }
  }, [open, apiKey])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const updated = await apiKeysApi.update(apiKey.id, {
        name: form.name?.trim() || undefined,
        scopes: form.scopes?.trim() || undefined,
        expiresAt: form.expiresAt || undefined,
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit API Key">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <Input
            value={form.name ?? ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Scopes{' '}
            <span className="text-xs font-normal text-gray-400">(JSON array)</span>
          </label>
          <Textarea
            placeholder='["agent:run","datasource:read"]'
            value={form.scopes ?? ''}
            onChange={e => setForm(f => ({ ...f, scopes: e.target.value }))}
            rows={2}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Expires at
          </label>
          <Input
            type="date"
            value={form.expiresAt ? form.expiresAt.split('T')[0] : ''}
            onChange={e =>
              setForm(f => ({
                ...f,
                expiresAt: e.target.value ? `${e.target.value}T00:00:00Z` : null,
              }))
            }
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// API Keys Page
// ============================================================================

export default function ApiKeysPage() {
  const [tenants, setTenants] = useState<TenantResponse[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [tenantsLoading, setTenantsLoading] = useState(true)

  const [keys, setKeys] = useState<ApiKeyResponse[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editKey, setEditKey] = useState<ApiKeyResponse | null>(null)
  const [deleteKey, setDeleteKey] = useState<ApiKeyResponse | null>(null)
  const [revokeKey, setRevokeKey] = useState<ApiKeyResponse | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  // Load tenants once
  useEffect(() => {
    setTenantsLoading(true)
    tenantsApi.list()
      .then(res => {
        const list = res.data?.content ?? []
        setTenants(list)
        if (list.length > 0) setSelectedTenantId(list[0].id)
      })
      .finally(() => setTenantsLoading(false))
  }, [])

  const load = useCallback(() => {
    if (!selectedTenantId) return
    setLoading(true)
    setError('')
    apiKeysApi.list(selectedTenantId, search || undefined, page, PAGE_SIZE)
      .then(res => {
        setKeys(res.content ?? [])
        setTotalElements(res.totalElements ?? 0)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load API keys'))
      .finally(() => setLoading(false))
  }, [selectedTenantId, search, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(0)
  }

  function handleCreated(key: ApiKeyResponse) {
    setKeys(prev => [key, ...prev])
    setTotalElements(n => n + 1)
    if (key.rawKey) setNewRawKey(key.rawKey)
  }

  function handleUpdated(key: ApiKeyResponse) {
    setKeys(prev => prev.map(k => k.id === key.id ? key : k))
  }

  async function handleRevoke() {
    if (!revokeKey) return
    setRevokeLoading(true)
    setRevokeError('')
    try {
      await apiKeysApi.revoke(revokeKey.id)
      setKeys(prev => prev.map(k => k.id === revokeKey.id ? { ...k, status: 'revoked' } : k))
      setRevokeKey(null)
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke key')
    } finally {
      setRevokeLoading(false)
    }
  }

  const totalPages = Math.ceil(totalElements / PAGE_SIZE)

  if (tenantsLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        Loading tenants…
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">API Keys</h1>
        <div className="rounded-xl border border-gray-200 bg-white dark:border-border-dark dark:bg-card-dark">
          <EmptyState icon={Key} title="No tenants found" description="Create a tenant before managing API keys." />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage SDK access keys scoped to each tenant.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!selectedTenantId}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Key
        </Button>
      </div>

      {/* Tenant selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tenant</label>
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
          value={selectedTenantId}
          onChange={e => { setSelectedTenantId(e.target.value); setPage(0) }}
        >
          {tenants.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.code ? ` (${t.code})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Raw key banner */}
      {newRawKey && (
        <RawKeyBanner rawKey={newRawKey} onDismiss={() => setNewRawKey(null)} />
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          leftIcon={<Search className="h-4 w-4" />}
          placeholder="Search by name…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-72"
        />
        <Button type="submit" variant="secondary">Search</Button>
        <span className="ml-auto self-center text-sm text-gray-400">
          {totalElements} key{totalElements !== 1 ? 's' : ''}
        </span>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border-dark dark:bg-card-dark">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading…
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No API keys"
            description="Create a key to allow SDK access for this tenant."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Key
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-border-dark dark:bg-panel-dark">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Prefix</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 md:table-cell">
                  Scopes
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 lg:table-cell">
                  Expires
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 lg:table-cell">
                  Last Used
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-border-dark">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-panel-dark">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-800 dark:text-gray-100">{k.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {k.keyPrefix ? (
                      <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-panel-dark dark:text-gray-300">
                        {k.keyPrefix}…
                      </code>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(k.status)}>{k.status}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 max-w-[14rem] md:table-cell">
                    {k.scopes ? (
                      <span className="block truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                        {k.scopes}
                      </span>
                    ) : (
                      <span className="text-gray-400">all</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 lg:table-cell">
                    {fmt(k.expiresAt)}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 lg:table-cell">
                    {fmtRelative(k.lastUsedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {k.status === 'active' && (
                        <button
                          onClick={() => setRevokeKey(k)}
                          className="rounded p-1.5 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 dark:hover:bg-yellow-900/20 dark:hover:text-yellow-400"
                          title="Revoke key"
                        >
                          <ShieldOff className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditKey(k)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-border-dark dark:hover:text-gray-200"
                        title="Edit key"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteKey(k)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Delete key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Create modal */}
      {selectedTenantId && (
        <CreateApiKeyModal
          tenantId={selectedTenantId}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit modal */}
      {editKey && (
        <EditApiKeyModal
          apiKey={editKey}
          open={!!editKey}
          onClose={() => setEditKey(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Revoke confirm */}
      {revokeKey && (
        <Modal
          open={!!revokeKey}
          onClose={() => { setRevokeKey(null); setRevokeError('') }}
          title="Revoke API Key"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Revoking{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                &ldquo;{revokeKey.name}&rdquo;
              </span>{' '}
              will immediately invalidate it. SDK calls using this key will fail.
            </p>
            {revokeError && (
              <p className="text-sm text-red-500">{revokeError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => { setRevokeKey(null); setRevokeError('') }}
                disabled={revokeLoading}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRevoke} loading={revokeLoading}>
                Revoke
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteKey && (
        <DeleteConfirmModal
          open={!!deleteKey}
          itemName={deleteKey.name}
          entityType="API key"
          onConfirm={async () => {
            await apiKeysApi.delete(deleteKey.id)
            setKeys(prev => prev.filter(k => k.id !== deleteKey.id))
            setTotalElements(n => n - 1)
            setDeleteKey(null)
          }}
          onClose={() => setDeleteKey(null)}
        />
      )}
    </div>
  )
}
