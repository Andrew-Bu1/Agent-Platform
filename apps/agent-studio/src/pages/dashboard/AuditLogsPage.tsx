import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, Search } from 'lucide-react'
import { auditLogsApi, tenantsApi } from '@/lib/api/access'
import type { AuditLogResponse, TenantResponse } from '@/lib/api/access-types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

// ---- helpers ----------------------------------------------------------------

function decisionVariant(decision: string | null): 'green' | 'red' | 'gray' {
  if (decision === 'allow') return 'green'
  if (decision === 'deny') return 'red'
  return 'gray'
}

function actorTypeBadge(actorType: string | null): 'blue' | 'yellow' | 'gray' {
  if (actorType === 'user') return 'blue'
  if (actorType === 'api_key') return 'yellow'
  return 'gray'
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function tryPrettyJson(raw: string | null): string {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

// ============================================================================
// Expandable Row
// ============================================================================

function LogRow({ log }: { log: AuditLogResponse }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-panel-dark"
        onClick={() => setExpanded(v => !v)}
      >
        {/* expand icon */}
        <td className="w-8 px-2 py-3 text-gray-400">
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </td>

        {/* timestamp */}
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {fmt(log.createdAt)}
        </td>

        {/* action */}
        <td className="px-4 py-3">
          <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700 dark:bg-panel-dark dark:text-gray-300">
            {log.action}
          </code>
        </td>

        {/* actor */}
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex items-center gap-1.5">
            <Badge variant={actorTypeBadge(log.actorType)}>
              {log.actorType ?? 'system'}
            </Badge>
            {log.actorId && (
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400 max-w-[10rem] truncate">
                {log.actorId}
              </span>
            )}
          </div>
        </td>

        {/* resource */}
        <td className="hidden px-4 py-3 text-xs text-gray-500 dark:text-gray-400 lg:table-cell">
          {log.resourceType ? (
            <span>
              {log.resourceType}
              {log.resourceId && (
                <span className="ml-1 font-mono text-gray-400">
                  /{log.resourceId.slice(0, 8)}…
                </span>
              )}
            </span>
          ) : '—'}
        </td>

        {/* decision */}
        <td className="px-4 py-3">
          {log.decision ? (
            <Badge variant={decisionVariant(log.decision)}>{log.decision}</Badge>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-gray-50 dark:bg-panel-dark">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Log ID" value={log.id} mono />
              <Detail label="Action" value={log.action} mono />
              <Detail label="Actor Type" value={log.actorType} />
              <Detail label="Actor ID" value={log.actorId} mono />
              <Detail label="Tenant ID" value={log.tenantId} mono />
              <Detail label="Resource Type" value={log.resourceType} />
              <Detail label="Resource ID" value={log.resourceId} mono />
              <Detail label="Decision" value={log.decision} />
              <Detail label="Reason" value={log.reason} />
              <Detail label="Timestamp" value={fmt(log.createdAt)} />
            </div>
            {log.metadata && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Metadata</p>
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400">
                  {tryPrettyJson(log.metadata)}
                </pre>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div>
      <p className="font-semibold text-gray-500 dark:text-gray-400">{label}</p>
      {value ? (
        <p className={mono ? 'mt-0.5 break-all font-mono text-gray-700 dark:text-gray-200' : 'mt-0.5 text-gray-700 dark:text-gray-200'}>
          {value}
        </p>
      ) : (
        <p className="mt-0.5 text-gray-400">—</p>
      )}
    </div>
  )
}

// ============================================================================
// Audit Logs Page
// ============================================================================

const DECISION_OPTIONS = ['', 'allow', 'deny'] as const
const RESOURCE_TYPES = ['', 'user', 'tenant', 'role', 'permission', 'api_key', 'agent', 'tool', 'prompt', 'model', 'datasource']

export default function AuditLogsPage() {
  const [tenants, setTenants] = useState<TenantResponse[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(true)

  const [logs, setLogs] = useState<AuditLogResponse[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // filters
  const [tenantFilter, setTenantFilter] = useState('')
  const [actorId, setActorId] = useState('')
  const [actionInput, setActionInput] = useState('')
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [decision, setDecision] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  // Load tenants for the tenant filter dropdown
  useEffect(() => {
    setTenantsLoading(true)
    tenantsApi.list()
      .then(res => setTenants(res.data?.content ?? []))
      .finally(() => setTenantsLoading(false))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    auditLogsApi.list({
      tenantId: tenantFilter || undefined,
      actorId: actorId.trim() || undefined,
      action: action.trim() || undefined,
      resourceType: resourceType || undefined,
      decision: decision || undefined,
      page,
      size: PAGE_SIZE,
    })
      .then(res => {
        setLogs(res.content ?? [])
        setTotalElements(res.totalElements ?? 0)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [tenantFilter, actorId, action, resourceType, decision, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setAction(actionInput)
    setPage(0)
  }

  function handleReset() {
    setTenantFilter('')
    setActorId('')
    setActionInput('')
    setAction('')
    setResourceType('')
    setDecision('')
    setPage(0)
  }

  const totalPages = Math.ceil(totalElements / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Searchable, filterable audit trail of all platform actions.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-border-dark dark:bg-card-dark">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          {/* Tenant */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Tenant</label>
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
              value={tenantFilter}
              onChange={e => { setTenantFilter(e.target.value); setPage(0) }}
              disabled={tenantsLoading}
            >
              <option value="">All tenants</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.code ? ` (${t.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Actor ID */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Actor ID</label>
            <Input
              placeholder="UUID or key ID"
              value={actorId}
              onChange={e => setActorId(e.target.value)}
              className="w-48"
            />
          </div>

          {/* Action */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Action</label>
            <Input
              placeholder="e.g. user:login"
              value={actionInput}
              onChange={e => setActionInput(e.target.value)}
              className="w-40"
            />
          </div>

          {/* Resource type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Resource Type</label>
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
              value={resourceType}
              onChange={e => { setResourceType(e.target.value); setPage(0) }}
            >
              {RESOURCE_TYPES.map(r => (
                <option key={r} value={r}>{r || 'All types'}</option>
              ))}
            </select>
          </div>

          {/* Decision */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Decision</label>
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-gray-100"
              value={decision}
              onChange={e => { setDecision(e.target.value); setPage(0) }}
            >
              {DECISION_OPTIONS.map(d => (
                <option key={d} value={d}>{d || 'All decisions'}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="submit">
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset}>
              Reset
            </Button>
          </div>

          <span className="ml-auto self-center text-sm text-gray-400">
            {totalElements.toLocaleString()} log{totalElements !== 1 ? 's' : ''}
          </span>
        </form>
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
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No audit logs found"
            description="Try adjusting the filters above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-border-dark dark:bg-panel-dark">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                    Action
                  </th>
                  <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 md:table-cell">
                    Actor
                  </th>
                  <th className="hidden px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 lg:table-cell">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">
                    Decision
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-border-dark">
                {logs.map(log => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
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
    </div>
  )
}
