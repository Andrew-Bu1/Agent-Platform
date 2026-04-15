import { useEffect, useState } from 'react'
import { Bot, FileText, Wrench } from 'lucide-react'
import { agentsApi, toolsApi } from '@/lib/api/studio'

interface Stat {
  label: string
  value: number | null
  icon: React.ElementType
  color: string
}

export function OverviewPage() {
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Agents', value: null, icon: Bot, color: 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' },
    { label: 'Tools', value: null, icon: Wrench, color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
    { label: 'Prompts', value: null, icon: FileText, color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400' },
  ])

  useEffect(() => {
    agentsApi.list(undefined, 0, 1).then(res => {
      if (res.data) {
        setStats(prev =>
          prev.map(s => s.label === 'Agents' ? { ...s, value: res.data!.totalElements } : s),
        )
      }
    }).catch(() => {})

    toolsApi.list(undefined, 0, 1).then(res => {
      if (res.data) {
        setStats(prev =>
          prev.map(s => s.label === 'Tools' ? { ...s, value: res.data!.totalElements } : s),
        )
      }
    }).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overview</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your agents, tools, and prompt versions from here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-border-dark dark:bg-card-dark"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {value === null ? (
                  <span className="inline-block h-7 w-8 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                ) : value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
