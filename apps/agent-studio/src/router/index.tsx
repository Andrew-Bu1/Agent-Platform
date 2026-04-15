import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      {/* Redirect root to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      {/* Placeholder dashboard – will be built next */}
      <Route
        path="/dashboard"
        element={
          <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400 dark:bg-surface-dark">
            Dashboard coming soon
          </div>
        }
      />
    </Routes>
  )
}
