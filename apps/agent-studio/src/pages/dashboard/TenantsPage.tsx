import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { tenantsApi, usersApi } from '@/lib/api/access'
import type {
  AddMemberRequest,
  CreateTenantRequest,
  MembershipResponse,
  TenantResponse,
  UpdateTenantRequest,
  UserResponse,
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
  if (status === 'disabled') return 'red'
  return 'gray'
}

function planVariant(plan: string): 'blue' | 'yellow' | 'gray' {
  if (plan === 'pro') return 'blue'
  if (plan === 'enterprise') return 'yellow'
  return 'gray'
}

function memberStatusVariant(status: string): 'green' | 'blue' | 'gray' {
  if (status === 'active') return 'green'
  if (status === 'invited') return 'blue'
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

// ============================================================================
// Create Tenant Modal
// ============================================================================

function CreateTenantModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (t: TenantResponse) => void
}) {
  const [form, setForm] = useState<CreateTenantRequest>({ name: '', code: '', planKey: 'basic' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) { setForm({ name: '', code: '', planKey: 'basic' }); setError('') }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    setLoading(true)
    try {
      const body: CreateTenantRequest = {
        name: form.name.trim(),
        code: form.code?.trim() || undefined,
        planKey: form.planKey || undefined,
      }
      const res = await tenantsApi.create(body)
      onCreated(res.data!)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Tenant">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="Acme Corp"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Code <span className="text-xs text-gray-400">(lowercase, hyphens)</span>
          </label>
          <Input
            placeholder="acme-corp"
            value={form.code ?? ''}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toLowerCase() }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Plan
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
            value={form.planKey ?? 'basic'}
            onChange={e => setForm(f => ({ ...f, planKey: e.target.value }))}
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Tenant
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// Edit Tenant Modal
// ============================================================================

function EditTenantModal({
  tenant,
  open,
  onClose,
  onUpdated,
}: {
  tenant: TenantResponse
  open: boolean
  onClose: () => void
  onUpdated: (t: TenantResponse) => void
}) {
  const [form, setForm] = useState<UpdateTenantRequest>({
    name: tenant.name,
    status: tenant.status,
    planKey: tenant.planKey,
    settings: tenant.settings ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ name: tenant.name, status: tenant.status, planKey: tenant.planKey, settings: tenant.settings ?? '' })
      setError('')
    }
  }, [open, tenant])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body: UpdateTenantRequest = {
        name: form.name?.trim() || undefined,
        status: form.status || undefined,
        planKey: form.planKey || undefined,
        settings: form.settings?.trim() || undefined,
      }
      const res = await tenantsApi.update(tenant.id, body)
      onUpdated(res.data!)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Tenant">
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
            Status
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
            value={form.status ?? 'active'}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Plan
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
            value={form.planKey ?? 'basic'}
            onChange={e => setForm(f => ({ ...f, planKey: e.target.value }))}
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Settings <span className="text-xs text-gray-400">(JSON)</span>
          </label>
          <Textarea
            placeholder='{"allow_google_login": true}'
            value={form.settings ?? ''}
            onChange={e => setForm(f => ({ ...f, settings: e.target.value }))}
            rows={3}
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
// Members Panel Modal
// ============================================================================

function MembersModal({
  tenant,
  open,
  onClose,
}: {
  tenant: TenantResponse
  open: boolean
  onClose: () => void
}) {
  const [members, setMembers] = useState<MembershipResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<UserResponse[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [addStatus, setAddStatus] = useState<'active' | 'invited'>('active')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [removeLoading, setRemoveLoading] = useState<string | null>(null)

  const loadMembers = useCallback(() => {
    setLoading(true)
    setError('')
    tenantsApi.getMembers(tenant.id)
      .then(res => setMembers(res.data ?? []))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load members'))
      .finally(() => setLoading(false))
  }, [tenant.id])

  useEffect(() => {
    if (open) {
      loadMembers()
      setShowAddForm(false)
      setUserSearch('')
      setUserResults([])
      setAddError('')
    }
  }, [open, loadMembers])

  function searchUsers() {
    if (!userSearch.trim()) return
    setUserSearchLoading(true)
    usersApi.list(userSearch.trim(), 0, 10)
      .then(res => setUserResults(res.data?.content ?? []))
      .catch(() => setUserResults([]))
      .finally(() => setUserSearchLoading(false))
  }

  async function handleAddMember(userId: string) {
    setAddLoading(true)
    setAddError('')
    try {
      const body: AddMemberRequest = { userId, status: addStatus }
      await tenantsApi.addMember(tenant.id, body)
      loadMembers()
      setShowAddForm(false)
      setUserSearch('')
      setUserResults([])
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemoveLoading(userId)
    try {
      await tenantsApi.removeMember(tenant.id, userId)
      setMembers(prev => prev.filter(m => m.userId !== userId))
    } catch {
      // silently log
    } finally {
      setRemoveLoading(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Members — ${tenant.name}`}>
      <div className="space-y-4">
        {/* Members list */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">Loading…</div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && members.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">No members yet.</p>
        )}
        {!loading && members.length > 0 && (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {members.map(m => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-border-dark dark:bg-panel-dark"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {m.userName ?? m.userEmail}
                  </p>
                  <p className="text-xs text-gray-400">{m.userEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={memberStatusVariant(m.status)}>{m.status}</Badge>
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    disabled={removeLoading === m.userId}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title="Remove member"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Add member */}
        {!showAddForm ? (
          <Button
            variant="secondary"
            onClick={() => setShowAddForm(true)}
            className="w-full"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add Member
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-border-dark dark:bg-panel-dark">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Member</p>

            <div className="flex gap-2">
              <Input
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUsers()}
                className="flex-1"
              />
              <Button variant="secondary" onClick={searchUsers} loading={userSearchLoading}>
                Search
              </Button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Join status
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
                value={addStatus}
                onChange={e => setAddStatus(e.target.value as 'active' | 'invited')}
              >
                <option value="active">Active</option>
                <option value="invited">Invited</option>
              </select>
            </div>

            {userResults.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {userResults.map(u => (
                  <li key={u.id}>
                    <button
                      onClick={() => handleAddMember(u.id)}
                      disabled={addLoading || members.some(m => m.userId === u.id)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-border-dark"
                    >
                      <span className="text-sm text-gray-800 dark:text-gray-100">
                        {u.name ?? u.email}
                      </span>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {addError && <p className="text-xs text-red-500">{addError}</p>}

            <Button
              variant="secondary"
              onClick={() => { setShowAddForm(false); setUserSearch(''); setUserResults([]) }}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}

// ============================================================================
// Tenants Page
// ============================================================================

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantResponse[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [planFilter, setPlanFilter] = useState<'all' | 'basic' | 'pro' | 'enterprise'>('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTenant, setEditTenant] = useState<TenantResponse | null>(null)
  const [deleteTenant, setDeleteTenant] = useState<TenantResponse | null>(null)
  const [membersForTenant, setMembersForTenant] = useState<TenantResponse | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    tenantsApi.list(search || undefined, page, PAGE_SIZE)
      .then(res => {
        setTenants(res.data?.content ?? [])
        setTotalElements(res.data?.totalElements ?? 0)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load tenants'))
      .finally(() => setLoading(false))
  }, [search, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(0)
  }

  function handleCreated(t: TenantResponse) {
    setTenants(prev => [t, ...prev])
    setTotalElements(n => n + 1)
  }

  function handleUpdated(t: TenantResponse) {
    setTenants(prev => prev.map(x => x.id === t.id ? t : x))
  }

  async function handleDelete() {
    if (!deleteTenant) return
    await tenantsApi.delete(deleteTenant.id)
    setTenants(prev => prev.filter(t => t.id !== deleteTenant.id))
    setTotalElements(n => n - 1)
    setDeleteTenant(null)
  }

  const filtered = tenants.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (planFilter !== 'all' && t.planKey !== planFilter) return false
    return true
  })

  const totalPages = Math.ceil(totalElements / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage tenants, their plans, and member access.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Tenant
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Search by name or code…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-72"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>

        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value as typeof planFilter)}
        >
          <option value="all">All plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <span className="ml-auto text-sm text-gray-400">
          {totalElements} tenant{totalElements !== 1 ? 's' : ''}
        </span>
      </div>

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
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No tenants found"
            description={search ? 'Try a different search term.' : 'Create your first tenant to get started.'}
            action={!search ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Tenant
              </Button>
            ) : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-border-dark dark:bg-panel-dark">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                  Plan
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 lg:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-border-dark">
              {filtered.map(tenant => (
                <tr
                  key={tenant.id}
                  className="group hover:bg-gray-50 dark:hover:bg-panel-dark"
                >
                  {/* Tenant info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900">
                        <Building2 className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-100">{tenant.name}</p>
                        {tenant.code && (
                          <p className="font-mono text-xs text-gray-400">{tenant.code}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(tenant.status)}>{tenant.status}</Badge>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3">
                    <Badge variant={planVariant(tenant.planKey)}>{tenant.planKey}</Badge>
                  </td>

                  {/* Created */}
                  <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 lg:table-cell">
                    {fmt(tenant.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setMembersForTenant(tenant)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-border-dark dark:hover:text-gray-200"
                        title="Manage members"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditTenant(tenant)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-border-dark dark:hover:text-gray-200"
                        title="Edit tenant"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTenant(tenant)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Delete tenant"
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
          <Button
            variant="secondary"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Modals */}
      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {editTenant && (
        <EditTenantModal
          tenant={editTenant}
          open={!!editTenant}
          onClose={() => setEditTenant(null)}
          onUpdated={handleUpdated}
        />
      )}

      {membersForTenant && (
        <MembersModal
          tenant={membersForTenant}
          open={!!membersForTenant}
          onClose={() => setMembersForTenant(null)}
        />
      )}

      {deleteTenant && (
        <DeleteConfirmModal
          open={!!deleteTenant}
          itemName={deleteTenant.name}
          entityType="tenant"
          onConfirm={handleDelete}
          onClose={() => setDeleteTenant(null)}
        />
      )}
    </div>
  )
}
