import { AgentStudioLogo, ThemeToggle } from '@/components/layout/BrandBar'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark transition-colors">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <AgentStudioLogo />
        <ThemeToggle />
      </header>

      {/* Center card */}
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-border-dark dark:bg-card-dark">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="pb-6 text-center text-xs text-gray-400 dark:text-gray-600">
        &copy; {new Date().getFullYear()} Agent Studio. All rights reserved.
      </footer>
    </div>
  )
}
