import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react'
import { permissionsApi, rolesApi } from '@/lib/api/access'
import type {
  AssignPermissionsRequest,
  CreatePermissionRequest,
  CreateRoleRequest,
  PermissionResponse,
  RoleResponse,
  UpdateRoleRequest,
} from '@/lib/api/access-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

// ---- helpers ----------------------------------------------------------------

function scopeBadgeVariant(scope: string): 'yellow' | 'blue' | 'gray' {
  if (scope === 'platform') return 'yellow'
  if (scope === 'tenant') return 'blue'
  return 'gray'
}

// ============================================================================
// Modals — Roles
// ============================================================================

function CreateRoleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (role: RoleResponse) => void
}) {
  const [form, setForm] = useState<CreateRoleRequest>({
    name: '',
    scopeType: 'tenant',
    description: '',
    isSystem: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setForm({ name: '', scopeType: 'tenant', description: '', isSystem: false })
    setError('')
    setLoading(false)
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      const created = await rolesApi.create({ ...form, name: form.name.trim() })
      onCreated(created)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create role">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. viewer"
          required
        />

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Scope type</label>
          <select
            value={form.scopeType}
            onChange={e => setForm(f => ({ ...f, scopeType: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-border-dark dark:bg-surface-dark dark:text-white"
          >
            <option value="tenant">Tenant</option>
            <option value="platform">Platform</option>
          </select>
        </div>

        <Textarea
          label="Description"
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe what this role grants..."
          rows={3}
        />

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isSystem ?? false}
            onChange={e => setForm(f => ({ ...f, isSystem: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">System role (cannot be deleted)</span>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Create role</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditRoleModal({
  role,
  open,
  onClose,
  onUpdated,
}: {
  role: RoleResponse | null
  open: boolean
  onClose: () => void
  onUpdated: (role: RoleResponse) => void
}) {
  const [form, setForm] = useState<UpdateRoleRequest>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (role) setForm({ name: role.name, description: role.description ?? '' })
  }, [role])

  function handleClose() {
    if (loading) return
    setError('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) return
    if (!form.name?.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      const updated = await rolesApi.update(role.id, { ...form, name: form.name.trim() })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Edit role">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name ?? ''}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />
        <Textarea
          label="Description"
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={3}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Save changes</Button>
        </div>
      </form>
    </Modal>
  )
}

function AssignPermissionsModal({
  role,
  open,
  onClose,
  onUpdated,
}: {
  role: RoleResponse | null
  open: boolean
  onClose: () => void
  onUpdated: (role: RoleResponse) => void
}) {
  const [allPerms, setAllPerms] = useState<PermissionResponse[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    permissionsApi.list(undefined, 0, 500)
      .then(p => setAllPerms(p.content))
      .catch(() => setError('Failed to load permissions'))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (role) {
      setSelected(new Set(role.permissions.map(p => p.id)))
    }
  }, [role])

  const filtered = allPerms.filter(p => {
    const q = search.toLowerCase()
    return p.resource.toLowerCase().includes(q) || p.action.toLowerCase().includes(q)
  })

  // Group by resource
  const grouped = filtered.reduce<Record<string, PermissionResponse[]>>((acc, p) => {
    const key = p.resource
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleClose() {
    if (saving) return
    setSearch('')
    setError('')
    onClose()
  }

  async function handleSave() {
    if (!role) return
    setSaving(true)
    setError('')
    try {
      const body: AssignPermissionsRequest = { permissionIds: Array.from(selected) }
      const updated = await rolesApi.assignPermissions(role.id, body)
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign permissions')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Assign permissions — ${role?.name ?? ''}`} size="lg">
      <div className="space-y-4">
        <Input
          placeholder="Search resource or action..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Search size={14} />}
        />

        <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-border-dark">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">Loading...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">No permissions found</div>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([resource, perms]) => (
              <div key={resource}>
                <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-surface-dark dark:text-gray-400">
                  {resource}
                </div>
                {perms.map(perm => (
                  <label
                    key={perm.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(perm.id)}
                      onChange={() => toggle(perm.id)}
                      className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                    />
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-200">
                      {perm.action}
                    </span>
                    {perm.description && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{perm.description}</span>
                    )}
                  </label>
                ))}
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-gray-400">{selected.size} permission{selected.size !== 1 ? 's' : ''} selected</p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================================
// Modals — Permissions
// ============================================================================

function CreatePermissionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (perm: PermissionResponse) => void
}) {
  const [form, setForm] = useState<CreatePermissionRequest>({ resource: '', action: '', description: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setForm({ resource: '', action: '', description: '' })
    setError('')
    setLoading(false)
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.resource.trim()) { setError('Resource is required'); return }
    if (!form.action.trim()) { setError('Action is required'); return }
    setLoading(true)
    setError('')
    try {
      const created = await permissionsApi.create({
        resource: form.resource.trim(),
        action: form.action.trim(),
        description: form.description?.trim() || undefined,
      })
      onCreated(created)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create permission')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create permission">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Resource"
          value={form.resource}
          onChange={e => setForm(f => ({ ...f, resource: e.target.value }))}
          placeholder="e.g. agents"
          required
        />
        <Input
          label="Action"
          value={form.action}
          onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
          placeholder="e.g. read"
          required
        />
        <Textarea
          label="Description"
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Optional description..."
          rows={2}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>Create permission</Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// Roles tab
// ============================================================================

function RoleRow({
  role,
  onEdit,
  onDelete,
  onAssign,
  onRemovePermission,
}: {
  role: RoleResponse
  onEdit: (r: RoleResponse) => void
  onDelete: (r: RoleResponse) => void
  onAssign: (r: RoleResponse) => void
  onRemovePermission: (roleId: string, permId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
          <Shield size={14} className="text-brand-600 dark:text-brand-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{role.name}</span>
            <Badge variant={scopeBadgeVariant(role.scopeType)}>{role.scopeType}</Badge>
            {role.isSystem && <Badge variant="red">system</Badge>}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
            </span>
          </div>
          {role.description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{role.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onAssign(role)}
            className="rounded p-1.5 text-xs text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
            title="Assign permissions"
          >
            <KeyRound size={14} />
          </button>
          <button
            onClick={() => onEdit(role)}
            className="rounded p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
            title="Edit role"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(role)}
            disabled={role.isSystem}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-900/20"
            title={role.isSystem ? 'System roles cannot be deleted' : 'Delete role'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded permissions */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-3 pt-2 dark:border-border-dark">
          {role.permissions.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">No permissions assigned. Click <KeyRound size={11} className="inline" /> to assign.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {role.permissions.map(perm => (
                <span
                  key={perm.id}
                  className="group flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-mono text-gray-700 dark:bg-white/10 dark:text-gray-200"
                >
                  <span>{perm.resource}:{perm.action}</span>
                  <button
                    onClick={() => onRemovePermission(role.id, perm.id)}
                    className="ml-0.5 rounded-full text-gray-400 hover:text-red-500"
                    title="Remove permission"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RolesTab() {
  const [roles, setRoles] = useState<RoleResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [editRole, setEditRole] = useState<RoleResponse | null>(null)
  const [assignRole, setAssignRole] = useState<RoleResponse | null>(null)
  const [deleteRole, setDeleteRole] = useState<RoleResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await rolesApi.list(search || undefined, 0, 100)
      setRoles(page.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { void load() }, [load])

  const filtered = scopeFilter === 'all'
    ? roles
    : roles.filter(r => r.scopeType === scopeFilter)

  function mergeRole(updated: RoleResponse) {
    setRoles(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  async function handleRemovePermission(roleId: string, permId: string) {
    try {
      const updated = await rolesApi.removePermission(roleId, permId)
      mergeRole(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove permission')
    }
  }

  async function handleDelete() {
    if (!deleteRole) return
    await rolesApi.delete(deleteRole.id)
    setRoles(prev => prev.filter(r => r.id !== deleteRole.id))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
        </div>

        <div className="relative">
          <select
            value={scopeFilter}
            onChange={e => setScopeFilter(e.target.value)}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-border-dark dark:bg-surface-dark dark:text-gray-200"
          >
            <option value="all">All scopes</option>
            <option value="platform">Platform</option>
            <option value="tenant">Tenant</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <Button onClick={() => setCreateOpen(true)}><Plus size={15} />New role</Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading roles...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No roles found"
          description={search ? 'Try a different search term.' : 'Create your first role.'}
          action={<Button onClick={() => setCreateOpen(true)}><Plus size={15} />New role</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(role => (
            <RoleRow
              key={role.id}
              role={role}
              onEdit={setEditRole}
              onDelete={setDeleteRole}
              onAssign={setAssignRole}
              onRemovePermission={handleRemovePermission}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateRoleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={r => setRoles(prev => [r, ...prev])}
      />
      <EditRoleModal
        role={editRole}
        open={editRole !== null}
        onClose={() => setEditRole(null)}
        onUpdated={mergeRole}
      />
      <AssignPermissionsModal
        role={assignRole}
        open={assignRole !== null}
        onClose={() => setAssignRole(null)}
        onUpdated={mergeRole}
      />
      <DeleteConfirmModal
        open={deleteRole !== null}
        onClose={() => setDeleteRole(null)}
        itemName={deleteRole?.name ?? ''}
        entityType="role"
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ============================================================================
// Permissions tab
// ============================================================================

function PermissionsTab() {
  const [perms, setPerms] = useState<PermissionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [resourceFilter, setResourceFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [deletePerm, setDeletePerm] = useState<PermissionResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await permissionsApi.list(search || undefined, 0, 500)
      setPerms(page.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { void load() }, [load])

  const allResources = Array.from(new Set(perms.map(p => p.resource))).sort()

  const filtered = perms.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.resource.toLowerCase().includes(q) || p.action.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
    const matchResource = resourceFilter === 'all' || p.resource === resourceFilter
    return matchSearch && matchResource
  })

  // Group by resource
  const grouped = filtered.reduce<Record<string, PermissionResponse[]>>((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = []
    acc[p.resource].push(p)
    return acc
  }, {})

  async function handleDelete() {
    if (!deletePerm) return
    await permissionsApi.delete(deletePerm.id)
    setPerms(prev => prev.filter(p => p.id !== deletePerm.id))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search permissions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
        </div>

        <div className="relative">
          <select
            value={resourceFilter}
            onChange={e => setResourceFilter(e.target.value)}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-border-dark dark:bg-surface-dark dark:text-gray-200"
          >
            <option value="all">All resources</option>
            {allResources.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <Button onClick={() => setCreateOpen(true)}><Plus size={15} />New permission</Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading permissions...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="No permissions found"
          description={search ? 'Try a different search or resource filter.' : 'Create your first permission.'}
          action={<Button onClick={() => setCreateOpen(true)}><Plus size={15} />New permission</Button>}
        />
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([resource, list]) => (
            <div key={resource} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark">
              {/* Resource header */}
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-border-dark">
                <Lock size={13} className="text-brand-500 dark:text-brand-400" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{resource}</span>
                <span className="ml-auto text-xs text-gray-400">{list.length} action{list.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Action rows */}
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {list.map(perm => (
                  <div
                    key={perm.id}
                    className="group flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-200 min-w-24">
                      {perm.action}
                    </span>
                    <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                      {perm.description ?? <span className="italic text-gray-300 dark:text-gray-600">No description</span>}
                    </span>
                    <button
                      onClick={() => setDeletePerm(perm)}
                      className="hidden rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 group-hover:block dark:hover:bg-red-900/20"
                      title="Delete permission"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreatePermissionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={p => setPerms(prev => [p, ...prev])}
      />
      <DeleteConfirmModal
        open={deletePerm !== null}
        onClose={() => setDeletePerm(null)}
        itemName={deletePerm ? `${deletePerm.resource}:${deletePerm.action}` : ''}
        entityType="permission"
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ============================================================================
// Page
// ============================================================================

type Tab = 'roles' | 'permissions'

export default function IdentityPage() {
  const [tab, setTab] = useState<Tab>('roles')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Identity Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage roles and permissions for access control across the platform.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-border-dark">
        {(['roles', 'permissions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'roles' ? <RolesTab /> : <PermissionsTab />}
    </div>
  )
}
