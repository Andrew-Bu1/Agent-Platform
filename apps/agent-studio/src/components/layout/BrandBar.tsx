import { useTheme } from '@/context/ThemeContext'
import { Moon, Sun, Triangle } from 'lucide-react'

export function AgentStudioLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 16, text: 'text-base' },
    md: { icon: 20, text: 'text-xl' },
    lg: { icon: 26, text: 'text-2xl' },
  }
  const { icon, text } = sizes[size]

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-md">
        <Triangle size={icon} fill="white" strokeWidth={0} />
      </div>
      <span className={`font-semibold tracking-tight text-gray-900 dark:text-white ${text}`}>
        Agent Studio
      </span>
    </div>
  )
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
