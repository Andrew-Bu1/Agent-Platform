import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        <Icon size={26} />
      </div>
      <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      {description && (
        <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">{description}</p>
      )}
      {action}
    </div>
  )
}
