import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { OverviewPage } from '@/pages/dashboard/OverviewPage'
import { AgentsPage } from '@/pages/dashboard/AgentsPage'
import { ToolsPage } from '@/pages/dashboard/ToolsPage'
import { PromptsPage } from '@/pages/dashboard/PromptsPage'
import { tokenStorage } from '@/lib/api/tokenStorage'
import { AUTH_EXPIRED_EVENT } from '@/lib/api/client'

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!tokenStorage.getAccessToken()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export function AppRouter() {
  const navigate = useNavigate()

  useEffect(() => {
    function handleAuthExpired() {
      navigate('/login', { replace: true })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  }, [navigate])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* Protected dashboard routes */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout>
              <OverviewPage />
            </DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/agents"
        element={
          <RequireAuth>
            <DashboardLayout>
              <AgentsPage />
            </DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/tools"
        element={
          <RequireAuth>
            <DashboardLayout>
              <ToolsPage />
            </DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/prompts"
        element={
          <RequireAuth>
            <DashboardLayout>
              <PromptsPage />
            </DashboardLayout>
          </RequireAuth>
        }
      />

      {/* Redirect root */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

