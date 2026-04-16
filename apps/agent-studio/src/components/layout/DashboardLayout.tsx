import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bot,
  Brain,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Key,
  LayoutDashboard,
  Layers,
  Moon,
  ScrollText,
  ShieldCheck,
  Sun,
  Users,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/context/ThemeContext'
import { AgentStudioLogo } from '@/components/layout/BrandBar'
import { UserMenu } from '@/components/layout/UserMenu'

interface NavItem {
  label: string
  icon: React.ElementType
  to: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Agents', icon: Bot, to: '/dashboard/agents' },
  { label: 'Tools', icon: Wrench, to: '/dashboard/tools' },
  { label: 'Prompts', icon: FileText, to: '/dashboard/prompts' },
  { label: 'Models', icon: Brain, to: '/dashboard/models' },
  { label: 'Datasources', icon: Database, to: '/dashboard/datasources' },
  { label: 'Identity', icon: ShieldCheck, to: '/dashboard/identity' },
  { label: 'Entitlements', icon: Layers, to: '/dashboard/entitlements' },
  { label: 'Tenants', icon: Building2, to: '/dashboard/tenants' },
  { label: 'Users', icon: Users, to: '/dashboard/users' },
  { label: 'API Keys', icon: Key, to: '/dashboard/api-keys' },
  { label: 'Audit Logs', icon: ScrollText, to: '/dashboard/audit-logs' },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-surface-dark">
      {/* Sidebar */}
      <aside
        className={cn(
          'relative flex flex-col border-r border-gray-200 bg-white transition-all duration-200 dark:border-border-dark dark:bg-card-dark',
          collapsed ? 'w-16' : 'w-56',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-gray-100 px-4 dark:border-border-dark">
          {collapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <span className="text-xs font-bold">AS</span>
            </div>
          ) : (
            <AgentStudioLogo size="sm" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-3">
          {NAV_ITEMS.map(({ label, icon: Icon, to }) => {
            const active =
              to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200',
                  collapsed && 'justify-center px-2',
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-gray-100 p-2 space-y-0.5 dark:border-border-dark">
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700',
              collapsed && 'justify-center px-2',
            )}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {!collapsed && 'Toggle theme'}
          </button>
          <UserMenu collapsed={collapsed} />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-brand-600 dark:border-border-dark dark:bg-card-dark dark:text-gray-400"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center border-b border-gray-200 bg-white px-6 dark:border-border-dark dark:bg-card-dark">
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {NAV_ITEMS.find(n =>
              n.to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(n.to),
            )?.label ?? 'Dashboard'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
