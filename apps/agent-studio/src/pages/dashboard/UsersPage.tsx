import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Pencil,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import { usersApi } from '@/lib/api/access'
import type {
  MembershipResponse,
  UpdateUserRequest,
  UserResponse,
} from '@/lib/api/access-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

// ---- helpers ----------------------------------------------------------------

function statusVariant(status: string): 'green' | 'red' | 'gray' {
  if (status === 'active') return 'green'
  if (status === 'disabled') return 'red'
  return 'gray'
}

function membershipStatusVariant(status: string): 'green' | 'blue' | 'gray' {
  if (status === 'active') return 'green'
  if (status === 'invited') return 'blue'
  return 'gray'
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// Edit User Modal
// ============================================================================

function EditUserModal({
  user,
  open,
  onClose,
  onUpdated,
}: {
  user: UserResponse
  open: boolean
  onClose: () => void
  onUpdated: (u: UserResponse) => void
}) {
  const [form, setForm] = useState<UpdateUserRequest>({
    name: user.name ?? '',
    status: user.status,
    avatarUrl: user.avatarUrl ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ name: user.name ?? '', status: user.status, avatarUrl: user.avatarUrl ?? '' })
      setError('')
    }
  }, [open, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body: UpdateUserRequest = {
        name: form.name || undefined,
        status: form.status || undefined,
        avatarUrl: form.avatarUrl || undefined,
      }
      const res = await usersApi.update(user.id, body)
      onUpdated(res.data!)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <Input
            placeholder="Display name"
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
            Avatar URL
          </label>
          <Input
            placeholder="https://..."
            value={form.avatarUrl ?? ''}
            onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))}
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
// Memberships Panel
// ============================================================================

function MembershipsModal({
  user,
  open,
  onClose,
}: {
  user: UserResponse
  open: boolean
  onClose: () => void
}) {
  const [memberships, setMemberships] = useState<MembershipResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    usersApi.getMemberships(user.id)
      .then(res => setMemberships(res.data ?? []))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load memberships'))
      .finally(() => setLoading(false))
  }, [open, user.id])

  return (
    <Modal open={open} onClose={onClose} title={`Memberships — ${user.name ?? user.email}`}>
      <div className="min-h-[120px]">
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            Loading…
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && memberships.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">No tenant memberships found.</p>
        )}
        {!loading && !error && memberships.length > 0 && (
          <ul className="space-y-2">
            {memberships.map(m => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-border-dark dark:bg-panel-dark"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {m.tenantName}
                    </p>
                    <p className="text-xs text-gray-400">
                      Joined {fmt(m.joinedAt)}
                    </p>
                  </div>
                </div>
                <Badge variant={membershipStatusVariant(m.status)}>{m.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}

// ============================================================================
// Users Page
// ============================================================================

export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')

  const [editUser, setEditUser] = useState<UserResponse | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserResponse | null>(null)
  const [membershipsUser, setMembershipsUser] = useState<UserResponse | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    usersApi.list(search || undefined, page, PAGE_SIZE)
      .then(res => {
        setUsers(res.data?.content ?? [])
        setTotalElements(res.data?.totalElements ?? 0)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [search, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(0)
  }

  function handleUserUpdated(updated: UserResponse) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
  }

  async function handleDelete() {
    if (!deleteUser) return
    await usersApi.delete(deleteUser.id)
    setUsers(prev => prev.filter(u => u.id !== deleteUser.id))
    setTotalElements(t => t - 1)
    setDeleteUser(null)
  }

  const filtered = statusFilter === 'all'
    ? users
    : users.filter(u => u.status === statusFilter)

  const totalPages = Math.ceil(totalElements / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Users</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage platform users and their tenant memberships.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Search by name or email…"
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

        <span className="ml-auto text-sm text-gray-400">
          {totalElements} user{totalElements !== 1 ? 's' : ''}
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
            icon={User}
            title="No users found"
            description={search ? 'Try a different search term.' : 'No users have been registered yet.'}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-border-dark dark:bg-panel-dark">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                  User
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 md:table-cell">
                  Email Verified
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 lg:table-cell">
                  Last Login
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 lg:table-cell">
                  Joined
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-border-dark">
              {filtered.map(user => (
                <tr
                  key={user.id}
                  className="group hover:bg-gray-50 dark:hover:bg-panel-dark"
                >
                  {/* User info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name ?? user.email}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                          {initials(user.name, user.email)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-100">
                          {user.name ?? <span className="italic text-gray-400">No name</span>}
                        </p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                  </td>

                  {/* Email verified */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    {user.emailVerified == null ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <Badge variant={user.emailVerified ? 'green' : 'red'}>
                        {user.emailVerified ? 'Verified' : 'Unverified'}
                      </Badge>
                    )}
                  </td>

                  {/* Last login */}
                  <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 lg:table-cell">
                    {fmt(user.lastLoginAt)}
                  </td>

                  {/* Joined */}
                  <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 lg:table-cell">
                    {fmt(user.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setMembershipsUser(user)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-border-dark dark:hover:text-gray-200"
                        title="View memberships"
                      >
                        <Building2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditUser(user)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-border-dark dark:hover:text-gray-200"
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteUser(user)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Delete user"
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
      {editUser && (
        <EditUserModal
          user={editUser}
          open={!!editUser}
          onClose={() => setEditUser(null)}
          onUpdated={handleUserUpdated}
        />
      )}

      {membershipsUser && (
        <MembershipsModal
          user={membershipsUser}
          open={!!membershipsUser}
          onClose={() => setMembershipsUser(null)}
        />
      )}

      {deleteUser && (
        <DeleteConfirmModal
          open={!!deleteUser}
          itemName={deleteUser.name ?? deleteUser.email}
          entityType="user"
          onConfirm={handleDelete}
          onClose={() => setDeleteUser(null)}
        />
      )}
    </div>
  )
}
